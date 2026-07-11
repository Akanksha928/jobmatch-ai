export function extractSkills(skillsText) {
  const structured = {
    languages: [],
    frameworks: [],
    testing: [],
    databases: [],
    cloud: [],
    other: []
  };

  if (!skillsText) return structured;

  // Split on category headers like "Languages :", "Tools and Frameworks :", etc.
  const categoryPattern = /(Languages|Tools\s+and\s+Frameworks|Frameworks|Testing\/CI\/CD|Database[s]?|DevOps\s+and\s+Cloud\s+Platforms?|Cloud)\s*:/gi;

  const parts = skillsText.split(categoryPattern);
  for (let i = 0; i < parts.length; i++) {
    const label = parts[i].trim().toLowerCase().replace(/\s+/g, '');
    const value = parts[i + 1];

    if (!value) continue;

    // Extract the comma-separated list for this category.
    // Stop at blank lines or next category header line.
    // Trim each item to its first newline to prevent header bleed like
    // "Jenkins\nBASAPPA RAGHAPUR\n..." ending up as the last skill.
    const rawChunk = value
      .split(/\n\s*\n/)[0]
      .split(/\n(?=[A-Z][A-Za-z\s]+\s*:)/)[0];

    const items = rawChunk
      .split(',')
      .map(s => s.split('\n')[0].trim())
      .filter(s => s.length > 0 && s.length < 60 && !s.includes('@') && !s.includes('GPA'));

    if (label.includes('language')) {
      structured.languages = items;
      i++;
    } else if (label.includes('framework') || label.includes('tools')) {
      structured.frameworks = items;
      i++;
    } else if (label.includes('testing') || label.includes('ci')) {
      structured.testing = items;
      i++;
    } else if (label.includes('database')) {
      structured.databases = items;
      i++;
    } else if (label.includes('devops') || label.includes('cloud')) {
      structured.cloud = items;
      i++;
    }
  }

  return structured;
}