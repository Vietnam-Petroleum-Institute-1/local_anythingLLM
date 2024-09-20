const path = require("path");
const fs = require("fs");
const {
  WATCH_DIRECTORY,
  SUPPORTED_FILETYPE_CONVERTERS,
} = require("../utils/constants");
const {
  trashFile,
  isTextType,
  normalizePath,
  isWithin,
} = require("../utils/files");
const { DocxLoader } = require("langchain/document_loaders/fs/docx");
const RESERVED_FILES = ["__HOTDIR__.md"];

async function processSingleFile(targetFilename, options = {}) {
  const fullFilePath = path.resolve(
    WATCH_DIRECTORY,
    normalizePath(targetFilename)
  );
  if (!isWithin(path.resolve(WATCH_DIRECTORY), fullFilePath))
    return {
      success: false,
      reason: "Filename is a not a valid path to process.",
      documents: [],
    };

  if (RESERVED_FILES.includes(targetFilename))
    return {
      success: false,
      reason: "Filename is a reserved filename and cannot be processed.",
      documents: [],
    };
  if (!fs.existsSync(fullFilePath))
    return {
      success: false,
      reason: "File does not exist in upload directory.",
      documents: [],
    };

  const fileExtension = path.extname(fullFilePath).toLowerCase();
  if (!fileExtension) {
    return {
      success: false,
      reason: `No file extension found. This file cannot be processed.`,
      documents: [],
    };
  }

  let processFileAs = fileExtension;
  if (!SUPPORTED_FILETYPE_CONVERTERS.hasOwnProperty(fileExtension)) {
    if (isTextType(fullFilePath)) {
      console.log(
        `\x1b[33m[Collector]\x1b[0m The provided filetype of ${fileExtension} does not have a preset and will be processed as .txt.`
      );
      processFileAs = ".txt";
    } else {
      trashFile(fullFilePath);
      return {
        success: false,
        reason: `File extension ${fileExtension} not supported for parsing and cannot be assumed as text file type.`,
        documents: [],
      };
    }
  }

  const FileTypeProcessor = require(SUPPORTED_FILETYPE_CONVERTERS[
    processFileAs
  ]);
  return await FileTypeProcessor({
    fullFilePath,
    filename: targetFilename,
    options,
  });
}

async function processSingleFile2(targetFilename, options = {}) {
  const fullFilePath = path.resolve(
    WATCH_DIRECTORY,
    normalizePath(targetFilename)
  );
  if (!isWithin(path.resolve(WATCH_DIRECTORY), fullFilePath))
    return {
      success: false,
      reason: "Filename is a not a valid path to process.",
      documents: [],
    };

  if (RESERVED_FILES.includes(targetFilename))
    return {
      success: false,
      reason: "Filename is a reserved filename and cannot be processed.",
      documents: [],
    };
  if (!fs.existsSync(fullFilePath))
    return {
      success: false,
      reason: "File does not exist in upload directory.",
      documents: [],
    };

  const fileExtension = path.extname(fullFilePath).toLowerCase();
  if (!fileExtension) {
    return {
      success: false,
      reason: `No file extension found. This file cannot be processed.`,
      documents: [],
    };
  }

  let processFileAs = fileExtension;
  const SUPPORTED_FILETYPE_DIFY = {
    ".txt": "./convert/asTxt.js",
    ".docx": "./convert/asDocx.js",
    // ".csv": "./convert/asTxt.js",
  };
  if (!SUPPORTED_FILETYPE_DIFY.hasOwnProperty(fileExtension)) {
    if (isTextType(fullFilePath) || fileExtension == ".csv") {
      console.log(
        `\x1b[33m[Collector]\x1b[0m The provided filetype of ${fileExtension} does not have a preset and will be processed as .txt.`
      );
      processFileAs = ".txt";
    } else {
      trashFile(fullFilePath);
      return {
        success: false,
        reason: `File extension ${fileExtension} not supported for parsing and cannot be assumed as text file type.`,
        documents: [],
      };
    }
  }

  let content = "";
  const filename = targetFilename;
  console.log(processFileAs);

  if (processFileAs == ".txt") {
    try {
      console.log(".txt");
      content = fs.readFileSync(fullFilePath, "utf8");
      console.log(content);

    } catch (err) {
      console.error("Could not read file!", err);
    }

  } else if (processFileAs == ".docx") {
    const loader = new DocxLoader(fullFilePath);
    let pageContent = [];
    const docs = await loader.load();
    for (const doc of docs) {
      console.log(`-- Parsing content from docx page --`);
      if (!doc.pageContent.length) continue;
      pageContent.push(doc.pageContent);
    }
    content = pageContent.join("");
  }
  if (content == "") {
    console.error(`Resulting text content was empty for ${filename}.`);
    trashFile(fullFilePath);
    return {
      success: false,
      reason: `No text content found in ${filename}.`,
      documents: [],
    };
  }
  trashFile(fullFilePath);
  return { success: true, reason: null, documents: [content] };
}

module.exports = {
  processSingleFile, processSingleFile2
};
