'use strict';

var fs = require('fs');
var assert = require('assert');
var path = require('path');

const ROOT_DIR = process.argv[2];

function convertFile(file, data) {
  var newPath = `${path.basename(file, '.txt')}.json`;

  var overviewData = {};

  data.split('\n')
    .map(x => x.trim())
    .forEach(line => {
      var matches = line.match(/^\"?(pos_x|pos_y|scale)\"?\s+"?(\S+)"?/);

      if (!matches) {
        return;
      }

      overviewData[matches[1]] = parseFloat(matches[2]);
    });

  fs.writeFile(newPath, JSON.stringify(overviewData, null, 2), assert.ifError);
}

function convertAll(files) {
  for (var file of files) {
    if (!file.endsWith('.txt')) {
      console.log('Skipping %s', file);
      continue;
    }

    (file => {
      fs.readFile(path.join(ROOT_DIR, file), 'utf8', (err, data) => {
        assert.ifError(err);
        convertFile(file, data);
      });
    })(file);
  }
}

fs.readdir(ROOT_DIR, (err, files) => {
  assert.ifError(err);
  convertAll(files);
});
