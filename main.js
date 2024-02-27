const {run: jscodeshift} = require('./src/Runner')
const path = require('node:path');
const process = require('node:process');

const transformPath = path.resolve('transform.js');
const debug = process.argv[2] === 'debug';
const paths =debug ? ['test/input1.js']: ["/Users/dzq/source/engine/creatorApp245"];
const options = {
  dry: false,
  print: false,
  verbose: 1,
  runInBand: debug,
  ignoreConfig: 'ignore',
  extensions: 'js',
}

// const canMulti = paths.length === 1 && path.extname(paths[0]) === '.js'


jscodeshift(transformPath, paths, options).then(res => {
    console.log(res);
})