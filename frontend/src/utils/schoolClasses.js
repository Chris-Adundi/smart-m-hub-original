export const CBC_CLASS_LEVELS = [
  {
    label: "Pre Primary",
    schoolTypes: ["pre_primary", "primary"],
    classes: ["PP1", "PP2"],
  },
  {
    label: "Lower Primary",
    schoolTypes: ["primary"],
    classes: ["Grade 1", "Grade 2", "Grade 3"],
  },
  {
    label: "Upper Primary",
    schoolTypes: ["primary"],
    classes: ["Grade 4", "Grade 5", "Grade 6"],
  },
  {
    label: "Junior School",
    schoolTypes: ["junior_secondary", "secondary"],
    classes: ["Grade 7", "Grade 8", "Grade 9"],
  },
  {
    label: "Senior School",
    schoolTypes: ["senior_secondary", "secondary"],
    classes: ["Grade 10", "Grade 11", "Grade 12"],
  },
];

export const ALL_CBC_CLASSES = CBC_CLASS_LEVELS.flatMap((level) => level.classes);

export const normalizeSchoolType = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

export const classLevelsForSchool = (school = {}) => {
  const type = normalizeSchoolType(school.school_type || school.type);
  if (!type || ["other", "college", "university"].includes(type)) {
    return CBC_CLASS_LEVELS;
  }

  const levels = CBC_CLASS_LEVELS.filter((level) => level.schoolTypes.includes(type));
  return levels.length ? levels : CBC_CLASS_LEVELS;
};

export const classesForSchool = (school = {}) =>
  classLevelsForSchool(school).flatMap((level) => level.classes);

export const learningAreasForClass = (className = "") => {
  const key = String(className || "").trim().toLowerCase().replace(/\s+/g, "");
  if (["pp1", "pp2"].includes(key)) {
    return [
      "Language Activities",
      "Mathematical Activities",
      "Environmental Activities",
      "Psychomotor and Creative Activities",
      "Religious Education Activities",
    ];
  }
  if (["grade1", "grade2", "grade3"].includes(key)) {
    return [
      "English Language Activities",
      "Kiswahili Language Activities",
      "Mathematical Activities",
      "Environmental Activities",
      "Creative Activities",
      "Religious Education",
    ];
  }
  if (["grade4", "grade5", "grade6"].includes(key)) {
    return [
      "English",
      "Kiswahili",
      "Mathematics",
      "Science & Technology",
      "Agriculture",
      "Social Studies",
      "Creative Arts",
      "Health Education",
      "Religious Education",
    ];
  }
  if (["grade7", "grade8", "grade9"].includes(key)) {
    return [
      "English",
      "Kiswahili",
      "Mathematics",
      "Integrated Science",
      "Business Studies",
      "Agriculture",
      "Social Studies",
      "Health Education",
      "Pre-Technical Studies",
      "Life Skills",
      "Religious Education",
      "Visual Arts",
      "Performing Arts",
      "Sports & Physical Education",
    ];
  }
  return [
    "English",
    "Kiswahili",
    "Mathematics",
    "Pathway Subject 1",
    "Pathway Subject 2",
    "Pathway Subject 3",
  ];
};

export const CBC_GRADE_OPTIONS = ["BE1", "BE2", "AE1", "AE2", "ME1", "ME2", "EE1", "EE2"];

export const gradeToMarks = (grade) => {
  const map = { BE1: 25, BE2: 35, AE1: 45, AE2: 55, ME1: 65, ME2: 75, EE1: 85, EE2: 95 };
  return map[String(grade || "").toUpperCase()] || 0;
};
