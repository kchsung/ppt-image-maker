# Netlify PPTX Worker Retirement Note

New PPT exports no longer invoke the Netlify worker. The active path is OpenAI Slide JSON planning, browser HTML/CSS rendering, `dom-to-pptx` conversion, PptxGenJS fallback/post-processing, and a short Supabase Storage save.

The Netlify worker remains a historical deployment artifact only. It is not required in Netlify environment variables and should not receive OpenAI or Supabase service-role credentials for the current flow.

Long-running LibreOffice render QA and `pptx-automizer` template adaptation may later run in a dedicated Node/container service, but they are intentionally separate from interactive PPTX generation.
