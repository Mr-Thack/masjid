import { execSync } from 'child_process';

const BUILD_ID = execSync('git rev-parse --short HEAD').toString().trim();
const BUILD_TIME = new Date().toISOString();

export const handle = async ({ event, resolve }) => {
  return resolve(event, {
    transformPageChunk: ({ html }) =>
      html.replace(
        '</head>',
        `<meta name="build-id" content="${BUILD_ID}">\n<meta name="build-time" content="${BUILD_TIME}">\n</head>`,
      ),
  });
};