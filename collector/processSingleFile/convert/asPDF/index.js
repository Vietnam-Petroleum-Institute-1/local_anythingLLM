const { v4 } = require("uuid");
const {
  createdDate,
  trashFile,
  writeToServerDocuments,
} = require("../../../utils/files");
const { tokenizeString } = require("../../../utils/tokenizer");
const { default: slugify } = require("slugify");
const PDFLoader = require("./PDFLoader");
const util = require('util');
const exec = util.promisify(require('child_process').exec);

// Đường dẫn đến tệp Python
const pythonScriptPath = '/Users/phamduyphuong/local_anythingLLM/collector/python_ocr/main.py';
const cudaPath = '/Users/phamduyphuong/local_anythingLLM/collector/python_ocr/cuda/bin/python'

async function execCMD(cmd) {
  const { stdout, stderr } = await exec(cmd);
  return stdout;
}

async function asPdf({ fullFilePath = "", filename = "" }) {
  const pdfLoader = new PDFLoader(fullFilePath, {
    splitPages: true,
  });
  console.log("Full File Path: " + fullFilePath);

  console.log(`-- Working ${filename} --`);
  const pageContent = [];
  const docs = await pdfLoader.load();

  for (const doc of docs) {
    console.log(
      `-- Parsing content from pg ${doc.metadata?.loc?.pageNumber || "unknown"
      } --`
    );
    if (!doc.pageContent || !doc.pageContent.length) continue;
    pageContent.push(doc.pageContent);
  }

  if (!pageContent.length) {

    const stdout = await execCMD(`${cudaPath} ${pythonScriptPath} -i ${fullFilePath}`);
    if (stdout) {
      console.log(stdout);
      pageContent.push(stdout);
    }

  }

  const content = pageContent.join("");
  if (content.trim().length == 0) {
    console.error(`Resulting text content was empty for ${filename}.`);
    trashFile(fullFilePath);
    return {
      success: false,
      reason: `No text content found in ${filename}.`,
      documents: [],
    };
  }
  const data = {
    id: v4(),
    url: "file://" + fullFilePath,
    title: filename,
    docAuthor: docs[0]?.metadata?.pdf?.info?.Creator || "no author found",
    description: docs[0]?.metadata?.pdf?.info?.Title || "No description found.",
    docSource: "pdf file uploaded by the user.",
    chunkSource: "",
    published: createdDate(fullFilePath),
    wordCount: content.split(" ").length,
    pageContent: content,
    token_count_estimate: tokenizeString(content).length,
  };

  const document = writeToServerDocuments(
    data,
    `${slugify(filename)}-${data.id}`
  );
  trashFile(fullFilePath);
  console.log(`[SUCCESS]: ${filename} converted & ready for embedding.\n`);
  return { success: true, reason: null, documents: [document] };
}

module.exports = asPdf;
