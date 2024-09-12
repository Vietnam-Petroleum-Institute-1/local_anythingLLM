const { v4 } = require("uuid");
const { DocxLoader } = require("langchain/document_loaders/fs/docx");
const {
    createdDate,
    trashFile,
    writeToServerDocuments,
} = require("../../utils/files");
const { tokenizeString } = require("../../utils/tokenizer");
const { default: slugify } = require("slugify");
const { exec } = require('child_process');
const { promisify } = require("util");
const execPromise = promisify(exec);

// Đường dẫn đến tệp Python
const pythonScriptPath = '/home/manhleo/Code/local_anythingLLM/collector/python_ocr/main.py';
const cudaPath = '/home/manhleo/Code/Learning_NLP/fcc-gpt-course/cuda/bin/python'

async function asImage({ fullFilePath = "", filename = "" }) {

    console.log(`-- Working ${filename} --`);
    let pageContent = [];
    // Thực thi tệp Python
    const { stdout, stderr } = await execPromise(`${cudaPath} ${pythonScriptPath} -i ${fullFilePath}`)
    if (stderr) {
        console.error(`stderr: ${stderr}`);
        return;
    }
    console.log(stdout);
    
    pageContent.push(stdout);

    if (!pageContent.length || pageContent[0] == '') {
        console.error(`Resulting text content was empty for ${filename}.`);
        trashFile(fullFilePath);
        return {
            success: false,
            reason: `No text content found in ${filename}.`,
            documents: [],
        };
    }

    const content = pageContent.join("");
    const data = {
        id: v4(),
        url: "file://" + fullFilePath,
        title: filename,
        docAuthor: "no author found",
        description: "No description found.",
        docSource: "Image file uploaded by the user.",
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

module.exports = asImage;
