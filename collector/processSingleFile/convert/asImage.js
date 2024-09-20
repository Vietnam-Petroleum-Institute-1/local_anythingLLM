const { v4 } = require("uuid");
const { DocxLoader } = require("langchain/document_loaders/fs/docx");
const {
    createdDate,
    trashFile,
    writeToServerDocuments,
} = require("../../utils/files");
const { tokenizeString } = require("../../utils/tokenizer");
const { default: slugify } = require("slugify");
const util = require('util');
const exec = util.promisify(require('child_process').exec);

// Đường dẫn đến tệp Python
const pythonScriptPath = '/Users/phamduyphuong/local_anythingLLM/collector/python_ocr/main.py';
const cudaPath = '/Users/phamduyphuong/local_anythingLLM/collector/python_ocr/cuda/bin/python'

async function execCMD(cmd) {
    const { stdout, stderr } = await exec(cmd);
    return stdout;
}

async function asImage({ fullFilePath = "", filename = "" }) {

    console.log(`-- Working ${filename} --`);
    let pageContent = [];
    // Thực thi tệp Python
    const stdout = await execCMD(`${cudaPath} ${pythonScriptPath} -i ${fullFilePath}`);

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
