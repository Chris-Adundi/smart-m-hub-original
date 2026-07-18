from __future__ import annotations

import asyncio
import os
import socket

from services.job_queue import claim_next_job, complete_job, fail_job


WORKER_ID = f"{socket.gethostname()}:{os.getpid()}"
POLL_SECONDS = float(os.getenv("WORKER_POLL_SECONDS", "2"))


async def process_bulk_generate(server, job: dict) -> dict:
    payload = job.get("payload") or {}
    school_id = payload["school_id"]
    exam = await server.db.exams.find_one({"id": payload["exam_id"], "school_id": school_id})
    if not exam:
        raise RuntimeError("Exam not found")
    actor = {
        "user_id": job.get("requested_by"),
        "role": payload.get("role") or "school_admin",
        "school_id": school_id,
        "email": payload.get("email"),
    }
    return await server.bulk_generate_reports_for_exam(school_id, exam, actor)


async def process_notification_delivery(server, job: dict) -> dict:
    payload = job.get("payload") or {}
    await server.db.notification_deliveries.insert_one({
        **payload,
        "job_id": job["id"],
        "status": "queued_for_provider",
        "created_at": server.now_utc(),
        "updated_at": server.now_utc(),
    })
    return {"queued": True}


async def process_report_pdf(server, job: dict) -> dict:
    payload = job.get("payload") or {}
    await server.db.report_jobs.update_one(
        {"id": payload.get("report_job_id")},
        {"$set": {"status": "queued_for_renderer", "updated_at": server.now_utc()}},
    )
    return {"report_job_id": payload.get("report_job_id"), "queued_for_renderer": True}


async def handle_job(server, job: dict) -> None:
    handlers = {
        "bulk_generate_assessment_reports": process_bulk_generate,
        "notification_delivery": process_notification_delivery,
        "assessment_report_pdf": process_report_pdf,
    }
    handler = handlers.get(job.get("job_type"))
    if not handler:
        raise RuntimeError(f"Unsupported job type: {job.get('job_type')}")
    result = await handler(server, job)
    await complete_job(server.db, job, result)


async def run_once(server) -> bool:
    job = await claim_next_job(
        server.db,
        worker_id=WORKER_ID,
        job_types=["bulk_generate_assessment_reports", "notification_delivery", "assessment_report_pdf"],
    )
    if not job:
        return False
    try:
        await handle_job(server, job)
    except Exception as exc:
        await fail_job(server.db, job, str(exc))
    return True


async def main():
    import server

    while True:
        processed = await run_once(server)
        if not processed:
            await asyncio.sleep(POLL_SECONDS)


if __name__ == "__main__":
    asyncio.run(main())
