import fs from "fs";
import { createRequire } from "module";
import { splitIntoSections } from "./utils/sectionSplitter.js";
import { extractSkills } from "./utils/skillExtractor.js";

const require = createRequire(import.meta.url);
const pdf = require("pdf-parse");

async function run() {
  try {
    const dataBuffer = fs.readFileSync("./resume.pdf");

    const data = await pdf(dataBuffer);

    const sections = splitIntoSections(data.text);

    console.log("\n====== STRUCTURED SECTIONS ======\n");
    console.log(sections);

    const skills = extractSkills(sections.skills);

    console.log("\n====== STRUCTURED SKILLS ======\n");
    console.log(skills);

  } catch (err) {
    console.error("Error:", err);
  }
}

run();