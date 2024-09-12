const util = require('util');
const exec = util.promisify(require('child_process').exec);

async function lsExample() {
    const { stdout, stderr } = await exec('/home/manhleo/Code/Learning_NLP/fcc-gpt-course/cuda/bin/python /home/manhleo/Code/local_anythingLLM/collector/python_ocr/main.py  -i /home/manhleo/Downloads/vpi1.pdf');
    console.log('stdout:', stdout);
    console.log('stderr:', stderr);
}
lsExample();