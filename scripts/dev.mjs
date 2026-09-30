import { spawn } from 'node:child_process';

const commands = [
  ['npm', ['run', 'dev', '--workspace', '@reproductor/server']],
  ['npm', ['run', 'dev', '--workspace', '@reproductor/web']],
];

const children = commands.map(([command, args]) => spawn(command, args, { stdio: 'inherit' }));

function stop() {
  for (const child of children) child.kill('SIGTERM');
}

process.on('SIGINT', stop);
process.on('SIGTERM', stop);

for (const child of children) {
  child.on('exit', (code) => {
    if (code !== 0 && code !== null) process.exitCode = code;
    stop();
  });
}
