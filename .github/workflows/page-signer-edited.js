#!/usr/bin/env node
/* eslint node: true */

const fs = require('fs');
const child_process = require('child_process');
const Minimize = require('minimize');

function errorAbort(text) {
  console.error(text);
  process.exit(1);
}

function getSignature(content, callback) {
  const tmpfile = `/tmp/${process.pid}`;
  const passcodeContent = process.env.GPG_SIGNING_KEY;
  fs.writeFileSync(tmpfile, content, 'utf-8');
  const gpg = child_process.spawnSync('gpg', [
    '--pinentry-mode', 'loopback',
    '--passphrase-fd', '0',
    '--armor',
    '--output', '-',
    '--detach-sign', '-',
    tmpfile
  ], {
    input: passcodeContent,
    stdio: ['pipe', 'pipe', process.stderr],
  });

  fs.unlink(tmpfile, () => {});

  callback(gpg.stdout.toString());
}

let args = process.argv.slice(2);

const filename = args.shift();
const outfile = args.shift();

if (!filename) {
  errorAbort(`Usage: ${process.argv[1]} <infile> [outfile]`);
}

fs.readFile(filename, 'utf8', (err, data) => {
  if (err) {
    errorAbort(err);
  }

  // Minimize and strip the doctype
  const content = new Minimize({ spare:true, conditionals: true, empty: true, quotes: true }).parse(data)
    .replace(/^\s*<!doctype[^>]*>/i, '');

  getSignature(content, (signature) => {
    const out = data.replace('%%%SIGNED_PAGES_PGP_SIGNATURE%%%', signature);

    if (outfile) {
      fs.writeFile(outfile, out, 'utf8', (writeErr) => {
        if (writeErr) {
          errorAbort(writeErr);
        }
      });
    } else {
      process.stdout.write(out);
    }
  });
});