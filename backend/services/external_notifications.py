from __future__ import annotations

import asyncio
import logging
import os
import re
import smtplib
import ssl
import uuid
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from email.message import EmailMessage
from typing import Any, Iterable, Optional

import httpx


logger = logging.getLogger("smart_m_hub.notifications")


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def normalize_email(value: object) -> Optional[str]:
    email = str(value or "").strip().lower()
    if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", email):
        return None
    return email


def normalize_kenyan_phone(value: object) -> Optional[str]:
    raw = re.sub(r"[\s().-]", "", str(value or "").strip())
    if raw.startswith("00"):
        raw = "+" + raw[2:]
    if raw.startswith("0") and len(raw) == 10:
        raw = "+254" + raw[1:]
    elif raw.startswith("254") and len(raw) == 12:
        raw = "+" + raw
    if not re.fullmatch(r"\+254(?:7\d{8}|1\d{8})", raw):
        return None
    return raw


class NotificationProviderError(RuntimeError):
    pass


class EmailProvider(ABC):
    @abstractmethod
    async def send(self, *, to: str, subject: str, text: str) -> str:
        raise NotImplementedError


class SmsProvider(ABC):
    @abstractmethod
    async def send(self, *, to: str, text: str) -> str:
        raise NotImplementedError


class DisabledEmailProvider(EmailProvider):
    async def send(self, **_kwargs) -> str:
        raise NotificationProviderError("Email provider is not configured")


class DisabledSmsProvider(SmsProvider):
    async def send(self, **_kwargs) -> str:
        raise NotificationProviderError("SMS provider is not configured")


class SmtpEmailProvider(EmailProvider):
    async def send(self, *, to: str, subject: str, text: str) -> str:
        host = os.getenv("SMTP_HOST", "").strip()
        username = os.getenv("SMTP_USERNAME", "").strip()
        password = os.getenv("SMTP_PASSWORD", "")
        sender = os.getenv("EMAIL_FROM", "").strip()
        if not host or not sender:
            raise NotificationProviderError("SMTP_HOST and EMAIL_FROM are required")
        port = int(os.getenv("SMTP_PORT", "587"))
        use_tls = os.getenv("SMTP_USE_TLS", "true").lower() in {"1", "true", "yes"}

        def deliver() -> None:
            message = EmailMessage()
            message["From"] = sender
            message["To"] = to
            message["Subject"] = subject
            message.set_content(text)
            with smtplib.SMTP(host, port, timeout=20) as client:
                if use_tls:
                    client.starttls(context=ssl.create_default_context())
                if username:
                    client.login(username, password)
                client.send_message(message)

        await asyncio.to_thread(deliver)
        return "accepted"


class SendGridEmailProvider(EmailProvider):
    async def send(self, *, to: str, subject: str, text: str) -> str:
        api_key = os.getenv("EMAIL_API_KEY", "").strip()
        sender = os.getenv("EMAIL_FROM", "").strip()
        if not api_key or not sender:
            raise NotificationProviderError("EMAIL_API_KEY and EMAIL_FROM are required")
        endpoint = os.getenv("EMAIL_API_URL", "https://api.sendgrid.com/v3/mail/send").strip()
        payload = {
            "personalizations": [{"to": [{"email": to}]}],
            "from": {"email": sender},
            "subject": subject,
            "content": [{"type": "text/plain", "value": text}],
        }
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.post(endpoint, headers={"Authorization": f"Bearer {api_key}"}, json=payload)
        if response.status_code >= 300:
            raise NotificationProviderError(f"Email provider returned HTTP {response.status_code}")
        return response.headers.get("x-message-id", "accepted")


class AfricasTalkingSmsProvider(SmsProvider):
    async def send(self, *, to: str, text: str) -> str:
        api_key = os.getenv("SMS_API_KEY", "").strip()
        username = os.getenv("SMS_USERNAME", "").strip()
        if not api_key or not username:
            raise NotificationProviderError("SMS_API_KEY and SMS_USERNAME are required")
        endpoint = os.getenv("SMS_API_URL", "https://api.africastalking.com/version1/messaging").strip()
        form = {"username": username, "to": to, "message": text}
        sender_id = os.getenv("SMS_SENDER_ID", "").strip()
        if sender_id:
            form["from"] = sender_id
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.post(endpoint, headers={"apiKey": api_key, "Accept": "application/json"}, data=form)
        if response.status_code >= 300:
            raise NotificationProviderError(f"SMS provider returned HTTP {response.status_code}")
        return "accepted"


class GenericSmsProvider(SmsProvider):
    async def send(self, *, to: str, text: str) -> str:
        api_key = os.getenv("SMS_API_KEY", "").strip()
        endpoint = os.getenv("SMS_API_URL", "").strip()
        if not api_key or not endpoint:
            raise NotificationProviderError("SMS_API_KEY and SMS_API_URL are required")
        payload = {"to": to, "message": text, "sender_id": os.getenv("SMS_SENDER_ID", "").strip()}
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.post(endpoint, headers={"Authorization": f"Bearer {api_key}"}, json=payload)
        if response.status_code >= 300:
            raise NotificationProviderError(f"SMS provider returned HTTP {response.status_code}")
        return "accepted"


def get_email_provider() -> EmailProvider:
    provider = os.getenv("EMAIL_PROVIDER", "disabled").strip().lower()
    if provider == "smtp":
        return SmtpEmailProvider()
    if provider == "sendgrid":
        return SendGridEmailProvider()
    return DisabledEmailProvider()


def get_sms_provider() -> SmsProvider:
    provider = os.getenv("SMS_PROVIDER", "disabled").strip().lower()
    if provider in {"africastalking", "africas_talking"}:
        return AfricasTalkingSmsProvider()
    if provider == "generic":
        return GenericSmsProvider()
    return DisabledSmsProvider()


async def dispatch_notifications(
    db: Any,
    *,
    school_id: str,
    title: str,
    message: str,
    recipients: Iterable[dict],
    channels: Iterable[str],
    event_type: str,
    requested_by: Optional[str] = None,
) -> dict:
    selected_channels = [channel for channel in dict.fromkeys(channels) if channel in {"email", "sms"}]
    summary = {"total": 0, "succeeded": 0, "failed": 0, "skipped": 0, "channels": selected_channels}
    records = []
    email_provider = get_email_provider()
    sms_provider = get_sms_provider()
    seen = set()

    for recipient in recipients:
        if str(recipient.get("school_id") or "") != str(school_id):
            summary["skipped"] += len(selected_channels)
            logger.warning("notification_recipient_rejected school_scope_mismatch event=%s", event_type)
            continue
        for channel in selected_channels:
            address = normalize_email(recipient.get("email")) if channel == "email" else normalize_kenyan_phone(recipient.get("phone"))
            if not address or (channel, address) in seen:
                summary["skipped"] += 1
                continue
            seen.add((channel, address))
            summary["total"] += 1
            status = "sent"
            error = None
            provider_reference = None
            try:
                if channel == "email":
                    provider_reference = await email_provider.send(to=address, subject=title, text=message)
                else:
                    provider_reference = await sms_provider.send(to=address, text=f"{title}: {message}")
                summary["succeeded"] += 1
                logger.info("notification_delivery_succeeded event=%s channel=%s school_id=%s", event_type, channel, school_id)
            except Exception as exc:
                status = "failed"
                error = str(exc)[:300]
                summary["failed"] += 1
                logger.warning("notification_delivery_failed event=%s channel=%s school_id=%s reason=%s", event_type, channel, school_id, type(exc).__name__)
            records.append({
                "id": str(uuid.uuid4()), "school_id": str(school_id), "event_type": event_type,
                "recipient_id": recipient.get("id"), "channel": channel, "destination": address,
                "status": status, "provider_reference": provider_reference, "error": error,
                "requested_by": requested_by, "created_at": now_utc(), "updated_at": now_utc(),
            })
    if records:
        try:
            await db.notification_deliveries.insert_many(records)
        except Exception as exc:
            logger.warning("notification_delivery_log_failed event=%s reason=%s", event_type, type(exc).__name__)
    return summary


async def resolve_announcement_recipients(db: Any, *, school_id: str, announcement: dict) -> list[dict]:
    audience = str(announcement.get("target_audience") or "all").lower()
    users = []
    students = []
    if audience in {"all", "staff", "parents", "specific_staff"}:
        user_query: dict = {"school_id": school_id, "approval_status": "approved", "is_active": True}
        if audience == "staff":
            user_query["role"] = {"$in": ["school_admin", "teacher", "finance", "secretary", "supporting_staff"]}
        elif audience == "parents":
            user_query["role"] = "parent"
        elif audience == "specific_staff":
            user_query["id"] = {"$in": [str(value) for value in announcement.get("target_staff_user_ids") or []]}
        users = await db.users.find(user_query, {"_id": 0}).to_list(1000)
    if audience in {"all", "students", "parents", "class", "specific_students"}:
        student_query: dict = {"school_id": school_id, "approval_status": "approved"}
        if audience == "class":
            student_query["class_name"] = announcement.get("target_class")
        elif audience == "specific_students":
            targets = [str(value) for value in announcement.get("target_student_ids") or []]
            student_query["$or"] = [{"id": {"$in": targets}}, {"admission_number": {"$in": targets}}]
        students = await db.students.find(student_query, {"_id": 0}).to_list(2000)

    recipients = [{"id": user.get("id"), "school_id": school_id, "email": user.get("email"), "phone": user.get("phone")} for user in users]
    for student in students:
        recipients.extend([
            {"id": f"{student.get('id')}:guardian1", "school_id": school_id, "email": student.get("guardian_email"), "phone": student.get("guardian_phone")},
            {"id": f"{student.get('id')}:guardian2", "school_id": school_id, "email": student.get("secondary_guardian_email"), "phone": student.get("secondary_guardian_phone")},
        ])
    return recipients
