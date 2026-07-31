from __future__ import annotations

from datetime import datetime, timezone


def _pdf_escape(value: object) -> str:
    return str(value or "").replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def render_simple_report_pdf(report: dict) -> bytes:
    learner = report.get("learner_details") or {}
    school = report.get("school_details") or {}
    generated_at = datetime.now(timezone.utc).strftime("%d %B %Y, %H:%M UTC")
    teacher_name = report.get("teacher_name") or report.get("prepared_by_name") or ""
    lines = [
        school.get("name") or "Smart M Hub",
        school.get("motto") or "",
        "CBC Assessment Report",
        f"Report Date: {generated_at}",
        "=" * 82,
        f"Learner: {learner.get('full_name') or ''}",
        f"Admission No: {learner.get('admission_number') or ''}",
        f"Class: {report.get('class_name') or learner.get('class_name') or ''}",
        f"Assessment / Examination: {report.get('exam_name') or ''}",
        f"Exam Number: {report.get('exam_number') or ''}",
        f"Term: {report.get('term') or ''}    Academic Year: {report.get('academic_year') or ''}",
        f"Class Teacher / Prepared By: {teacher_name}",
        f"Status: {report.get('status') or ''}",
        "",
        "LEARNING AREAS",
        "-" * 82,
    ]
    for area in report.get("learning_areas") or []:
        lines.append(
            f"{area.get('name') or area.get('learning_area') or ''}: "
            f"Score {area.get('score') if area.get('score') not in (None, '') else '-'} | "
            f"Level {area.get('overall_grade') or area.get('achievement_level') or '-'} | "
            f"Comment: {area.get('teacher_remarks') or '-'}"
        )
    lines.extend([
        "", f"Teacher's Comment: {report.get('teacher_remarks') or '-'}",
        f"Principal's Comment: {report.get('principal_remarks') or '-'}", "",
        f"Teacher's Name: {teacher_name or '-'}",
        "Teacher's Signature: ____________________    Date: ____________________",
        "Principal's Signature: ___________________    Official Stamp: __________",
    ])

    content_lines = ["BT", "/F1 12 Tf", "50 560 Td"]
    for index, line in enumerate(lines[:34]):
        if index:
            content_lines.append("0 -15 Td")
        content_lines.append(f"({_pdf_escape(line)}) Tj")
    content_lines.append("ET")
    stream = "\n".join(content_lines).encode("utf-8")

    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        b"<< /Length " + str(len(stream)).encode("ascii") + b" >>\nstream\n" + stream + b"\nendstream",
    ]

    pdf = bytearray(b"%PDF-1.4\n")
    offsets = [0]
    for number, obj in enumerate(objects, start=1):
        offsets.append(len(pdf))
        pdf.extend(f"{number} 0 obj\n".encode("ascii"))
        pdf.extend(obj)
        pdf.extend(b"\nendobj\n")
    xref_start = len(pdf)
    pdf.extend(f"xref\n0 {len(objects) + 1}\n".encode("ascii"))
    pdf.extend(b"0000000000 65535 f \n")
    for offset in offsets[1:]:
        pdf.extend(f"{offset:010d} 00000 n \n".encode("ascii"))
    pdf.extend(
        f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref_start}\n%%EOF\n".encode("ascii")
    )
    return bytes(pdf)
