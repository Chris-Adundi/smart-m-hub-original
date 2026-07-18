from __future__ import annotations

from datetime import datetime, timezone


def _pdf_escape(value: object) -> str:
    return str(value or "").replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def render_simple_report_pdf(report: dict) -> bytes:
    learner = report.get("learner_details") or {}
    school = report.get("school_details") or {}
    lines = [
        school.get("name") or "Smart M Hub",
        "CBC Assessment Report",
        f"Learner: {learner.get('full_name') or ''}",
        f"Admission No: {learner.get('admission_number') or ''}",
        f"Class: {report.get('class_name') or learner.get('class_name') or ''}",
        f"Exam: {report.get('exam_name') or ''}",
        f"Term: {report.get('term') or ''}",
        f"Academic Year: {report.get('academic_year') or ''}",
        f"Status: {report.get('status') or ''}",
        f"Generated: {datetime.now(timezone.utc).isoformat()}",
        "",
        "Learning Areas",
    ]
    for area in report.get("learning_areas") or []:
        lines.append(
            f"- {area.get('name') or area.get('learning_area') or ''}: "
            f"{area.get('overall_grade') or area.get('achievement_level') or ''}"
        )

    content_lines = ["BT", "/F1 12 Tf", "50 560 Td"]
    for index, line in enumerate(lines[:28]):
        if index:
            content_lines.append("0 -18 Td")
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
