# JobMatch AI

JobMatch AI is a Chrome Extension that helps job seekers compare their resume against a LinkedIn job posting and receive AI-generated feedback on how well their experience matches the role.

## What it does

- Lets you upload a resume from your computer as a PDF or plain text file
- Extracts the current job description from a LinkedIn jobs page
- Sends the resume and job description to a local Express backend
- Returns:
  - a match score from 0 to 100
  - missing skills
  - a short alignment summary
  - suggested bullet rewrites to better match the role
- Displays the results in a panel on the LinkedIn page

## Project structure

- [manifest.json](manifest.json) — Chrome extension manifest for MV3
- [background.js](background.js) — message bridge between the extension and the backend
- [content.js](content.js) — injects the UI panel into LinkedIn job pages and analyzes the page content
- [popup.js](popup.js) — popup UI for uploading and storing the resume
- [server.js](server.js) — Express API that runs the resume/job analysis flow
- [utils/sectionSplitter.js](utils/sectionSplitter.js) — parses resume sections
- [utils/skillExtractor.js](utils/skillExtractor.js) — extracts skill keywords from the resume

## Tech stack

- Chrome Extension Manifest V3
- JavaScript / HTML / CSS
- Node.js + Express
- PDF.js for resume parsing
- GitHub Models / Azure AI Inference endpoint for the AI analysis

## Setup

1. Install dependencies
   ```bash
   npm install
   ```

2. Create a .env file in the project root with your model token:
   ```env
   GITHUB_TOKEN=your_token_here
   ```

3. Start the backend
   ```bash
   npm start
   ```
   The server runs on port 4000.

4. Load the extension in Chrome
   - Open chrome://extensions/
   - Enable Developer mode
   - Click Load unpacked
   - Select this project folder

5. Open a LinkedIn jobs page and upload your resume from the extension popup

## How it works

1. The popup stores your resume text in Chrome local storage.
2. The content script detects a LinkedIn job page and reads the job description.
3. The extension sends the resume and job text to the local backend.
4. The backend processes the resume structure, builds a prompt, and sends it to the AI model.
5. The extension displays the returned insights in a panel on the page.

## Notes

- The extension is designed for LinkedIn job pages and uses selectors that match common LinkedIn job description layouts.
- The AI response is intended to help with resume tailoring, not to guarantee a match.
- The backend currently expects a valid token in the .env file before it can make model requests.


