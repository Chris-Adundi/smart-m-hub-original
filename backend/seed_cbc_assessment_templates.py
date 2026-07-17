import os
import uuid
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
from pymongo import MongoClient


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "smart_m_hub")

ACHIEVEMENT_LEVELS = [
    {"code": "EE", "name": "Exceeding Expectations", "min_score": 80, "max_score": 100},
    {"code": "ME", "name": "Meeting Expectations", "min_score": 60, "max_score": 79},
    {"code": "AE", "name": "Approaching Expectations", "min_score": 40, "max_score": 59},
    {"code": "BE", "name": "Below Expectations", "min_score": 0, "max_score": 39},
]

COMPETENCIES = [
    "Communication & Collaboration",
    "Critical Thinking & Problem Solving",
    "Creativity & Imagination",
    "Citizenship",
    "Digital Literacy",
    "Learning to Learn",
    "Self-Efficacy",
]

VALUES = ["Respect", "Responsibility", "Integrity", "Unity", "Peace", "Love", "Patriotism"]

CLASS_AREAS = {
    "PP1": ["Language Activities", "Mathematical Activities", "Environmental Activities", "Psychomotor and Creative Activities", "Religious Education Activities"],
    "PP2": ["Language Activities", "Mathematical Activities", "Environmental Activities", "Psychomotor and Creative Activities", "Religious Education Activities"],
    "Grade 1": ["English Language Activities", "Kiswahili Language Activities", "Mathematical Activities", "Environmental Activities", "Creative Activities", "Religious Education"],
    "Grade 2": ["English Language Activities", "Kiswahili Language Activities", "Mathematical Activities", "Environmental Activities", "Creative Activities", "Religious Education"],
    "Grade 3": ["English Language Activities", "Kiswahili Language Activities", "Mathematical Activities", "Environmental Activities", "Creative Activities", "Religious Education"],
    "Grade 4": ["English", "Kiswahili", "Mathematics", "Science & Technology", "Agriculture", "Social Studies", "Creative Arts", "Health Education", "Religious Education"],
    "Grade 5": ["English", "Kiswahili", "Mathematics", "Science & Technology", "Agriculture", "Social Studies", "Creative Arts", "Health Education", "Religious Education"],
    "Grade 6": ["English", "Kiswahili", "Mathematics", "Science & Technology", "Agriculture", "Social Studies", "Creative Arts", "Health Education", "Religious Education"],
    "Grade 7": ["English", "Kiswahili", "Mathematics", "Integrated Science", "Business Studies", "Agriculture", "Social Studies", "Health Education", "Pre-Technical Studies", "Life Skills", "Religious Education", "Visual Arts", "Performing Arts", "Sports & Physical Education"],
    "Grade 8": ["English", "Kiswahili", "Mathematics", "Integrated Science", "Business Studies", "Agriculture", "Social Studies", "Health Education", "Pre-Technical Studies", "Life Skills", "Religious Education", "Visual Arts", "Performing Arts", "Sports & Physical Education"],
    "Grade 9": ["English", "Kiswahili", "Mathematics", "Integrated Science", "Business Studies", "Agriculture", "Social Studies", "Health Education", "Pre-Technical Studies", "Life Skills", "Religious Education", "Visual Arts", "Performing Arts", "Sports & Physical Education"],
}

SENIOR_PATHWAYS = {
    "stem": ["English", "Kiswahili", "Community Service Learning", "Physical Education", "Mathematics", "Biology", "Chemistry", "Physics", "Computer Science", "Agriculture"],
    "social_sciences": ["English", "Kiswahili", "Community Service Learning", "Physical Education", "History & Citizenship", "Geography", "Business Studies", "Religious Education", "Economics"],
    "arts_sports_science": ["English", "Kiswahili", "Community Service Learning", "Physical Education", "Fine Arts", "Music & Dance", "Theatre & Film", "Sports Science", "Media Studies"],
}


def now_utc():
    return datetime.now(timezone.utc)


def learning_areas(names):
    return [
        {
            "name": name,
            "strands": [],
            "sub_strands": [],
            "score": None,
            "achievement_level": "",
            "teacher_remarks": "",
            "overall_grade": "",
        }
        for name in names
    ]


def named_assessments(names):
    return [{"name": name, "achievement_level": "", "teacher_remarks": ""} for name in names]


def template_doc(school_id, class_name, names, pathway=None):
    return {
        "id": str(uuid.uuid4()),
        "school_id": school_id,
        "class_name": class_name,
        "pathway": pathway,
        "title": f"CBC Assessment Template - {class_name}",
        "learning_areas": learning_areas(names),
        "competencies": named_assessments(COMPETENCIES),
        "values": named_assessments(VALUES),
        "achievement_levels": ACHIEVEMENT_LEVELS,
        "is_active": True,
        "seeded": True,
        "created_at": now_utc(),
        "updated_at": now_utc(),
    }


def main():
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    schools = list(db.schools.find({}, {"id": 1}))
    if not schools:
        print("No schools found. Register a school first, then rerun this script.")
        return

    created = 0
    for school in schools:
        school_id = school.get("id")
        for class_name, names in CLASS_AREAS.items():
            exists = db.assessment_templates.find_one({
                "school_id": school_id,
                "class_name": class_name,
                "pathway": None,
                "is_active": True,
            })
            if not exists:
                db.assessment_templates.insert_one(template_doc(school_id, class_name, names))
                created += 1
        for grade in ["Grade 10", "Grade 11", "Grade 12"]:
            for pathway, names in SENIOR_PATHWAYS.items():
                exists = db.assessment_templates.find_one({
                    "school_id": school_id,
                    "class_name": grade,
                    "pathway": pathway,
                    "is_active": True,
                })
                if not exists:
                    db.assessment_templates.insert_one(template_doc(school_id, grade, names, pathway))
                    created += 1

    print(f"Seeded {created} CBC assessment templates.")


if __name__ == "__main__":
    main()
