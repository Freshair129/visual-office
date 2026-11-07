import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createOfficeReleaseServer} from './office-release-server.mjs';

const root = resolve(fileURLToPath(new URL('../release/office', import.meta.url)));
const port = Number(process.env.PORT || 4177);
const server = createOfficeReleaseServer(root);
server.listen(port, '127.0.0.1', () => {
  console.log(`Visual Office release: http://127.0.0.1:${port}/office/`);
});
