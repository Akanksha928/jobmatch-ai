export function splitIntoSections(text) {
    const sections = {
        header: "",
        education: "",
        experience: "",
        projects: "",
        skills: "",
        summary: "",
        other: ""
    };

    // Normalize spaced-out caps like "E DUCATION" → "EDUCATION"
    // Run twice to handle 3+ character words like "SKILLS" → "S K I L L S"
    text = text.replace(/\b([A-Z])\s+([A-Z])/g, '$1$2');
    text = text.replace(/\b([A-Z])\s+([A-Z])/g, '$1$2');
    text = text.replace(/\b([A-Z])\s+([A-Z])/g, '$1$2');

    // Map section header keywords to section keys.
    // Order matters — more specific patterns first.
    const HEADER_MAP = [
        { pattern: /^(TECHNICAL\s+SKILLS?|SKILLS?)$/i,  key: "skills"      },
        { pattern: /^EDUCATION$/i,                        key: "education"   },
        { pattern: /^EXPERIENCE$/i,                       key: "experience"  },
        { pattern: /^PROJECTS?$/i,                        key: "projects"    },
        { pattern: /^SUMMARY$/i,                          key: "summary"     },
        { pattern: /^(CERTIFICATIONS?|RESEARCH)$/i,       key: "other"       },
    ];

    const lines = text.split(/\r?\n/);
    let currentSection = "header";

    for (const rawLine of lines) {
        const trimmed = rawLine.trim();

        // Check if this line is EXACTLY a section header (whole-line match only)
        const matched = HEADER_MAP.find(({ pattern }) => pattern.test(trimmed));
        if (matched) {
            currentSection = matched.key;
            continue;
        }

        sections[currentSection] += trimmed + "\n";
    }

    // Trim trailing whitespace from each section
    for (const key of Object.keys(sections)) {
        sections[key] = sections[key].trim();
    }

    return sections;
}