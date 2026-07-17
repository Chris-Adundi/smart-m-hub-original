from server import (
    DEFAULT_ACHIEVEMENT_LEVELS,
    blank_attendance,
    build_learning_areas,
    default_learning_area_names,
    normalize_class_key,
    normalize_pathway,
)


def test_normalize_class_key_supports_pp_and_grades():
    assert normalize_class_key("PP1") == "pp1"
    assert normalize_class_key("Pre Primary 2") == "pp2"
    assert normalize_class_key("Grade 7") == "grade_7"


def test_default_learning_areas_cover_cbc_bands():
    assert "Language Activities" in default_learning_area_names("PP1")
    assert "English Language Activities" in default_learning_area_names("Grade 1")
    assert "Science & Technology" in default_learning_area_names("Grade 4")
    assert "Integrated Science" in default_learning_area_names("Grade 8")
    assert "Computer Science" in default_learning_area_names("Grade 10", "STEM")
    assert "Sports Science" in default_learning_area_names("Grade 12", "Arts & Sports Science")


def test_build_learning_areas_returns_blank_assessment_fields():
    areas = build_learning_areas(["English"])
    assert areas == [
        {
            "name": "English",
            "strands": [],
            "sub_strands": [],
            "score": None,
            "achievement_level": "",
            "teacher_remarks": "",
            "overall_grade": "",
        }
    ]


def test_assessment_defaults_are_blank_and_configurable():
    attendance = blank_attendance()
    assert attendance["days_open"] is None
    assert [level["code"] for level in DEFAULT_ACHIEVEMENT_LEVELS] == ["EE", "ME", "AE", "BE"]
    assert normalize_pathway("Arts & Sports Science") == "arts_sports_science"
