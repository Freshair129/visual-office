const audit = document.querySelector('#audit');

async function read() {
  const response = await fetch('/__fixture/log');
  if (!response.ok) throw new Error('Synthetic server required');
  audit.textContent = JSON.stringify(await response.json(), null, 2);
}

async function control(body) {
  const response = await fetch('/__fixture/control', {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error('Rejected');
  await read();
}

document.querySelector('#scene-fault').onchange = event => control({sceneFault: event.target.value});
document.querySelector('#scenario').onchange = event => control({scenario: event.target.value});
for (const id of ['release', 'expire', 'reset']) {
  document.querySelector('#' + id).onclick = () => control({action: id});
}
document.querySelector('#read').onclick = read;

await read();
const context = await (await fetch('/__fixture/context-cases')).json();
if (context.dynamicMode) {
  document.querySelector('#context-controls').hidden = false;
  const select = document.querySelector('#context-case');
  for (const vector of context.vectors) {
    const option = document.createElement('option');
    option.value = vector.id;
    option.textContent = vector.id + ' · ' + vector.origin;
    select.append(option);
  }
  select.value = context.contextCase;
  select.onchange = () => control({contextCase: select.value});
  document.querySelector('#context-hold').onchange = event => control({contextHold: event.target.checked});
}
