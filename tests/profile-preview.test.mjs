import assert from 'node:assert/strict';
import test from 'node:test';
import { File } from 'node:buffer';
import * as jsx from 'react/jsx-runtime';
import { moduleLoader } from './helpers/module-loader.mjs';

function nodes(element, result = []) {
  if (!element || typeof element !== 'object') return result;
  result.push(element);
  for (const child of [element.props?.children].flat(Infinity)) nodes(child, result);
  return result;
}
async function form() {
  const values = [];
  let cursor = 0, saves = 0;
  const { ProfileForm } = await moduleLoader('app/profile/profile-form.tsx', {
    'react/jsx-runtime': jsx,
    react: {
      useState(initial) {
        const index = cursor++;
        if (!(index in values)) values[index] = initial;
        return [values[index], value => { values[index] = value; }];
      },
      useRef(initial) {
        const index = cursor++;
        if (!(index in values)) values[index] = { current: initial };
        return values[index];
      },
      useEffect() {},
      useActionState(action, initial) { return [initial, action, false]; },
    },
    './actions': { saveProfile: async () => { saves++; return { saved: true }; } },
  });
  const render = () => {
    cursor = 0;
    return nodes(ProfileForm({ profile: { first_name: 'Ada', last_name: 'Lovelace' }, avatarUrl: null }));
  };
  const select = async file => {
    const input = render().find(node => node.type === 'input' && node.props.type === 'file');
    input.props.ref.current = { value: file.name };
    await input.props.onChange({ target: { files: [file] } });
  };
  const cleanup = () => { for (const value of values) if (typeof value === 'string' && value.startsWith('blob:')) URL.revokeObjectURL(value); };
  return { render, select, saves: () => saves, cleanup };
}

test('profile file selection creates a local preview and save hint without uploading', async () => {
  const f = await form();
  try {
    assert.equal(f.render().find(n => n.props?.['aria-label'] === 'Your initials').props.children, 'AL');
    assert.equal(f.render().find(n => n.type === 'input' && n.props.type === 'file').props.hidden, true);
    await f.select(new File([new Uint8Array([255, 216, 255, 0])], 'portrait.jpg', { type: 'image/jpeg' }));
    const rendered = f.render();
    assert.match(rendered.find(n => n.type === 'img').props.src, /^blob:/);
    const hint = rendered.find(n => n.props?.id === 'photo-selection').props.children.flat().join('');
    assert.match(hint, /portrait.jpg.*Save profile to upload/);
    assert.equal(f.saves(), 0);
  } finally { f.cleanup(); }
});

test('invalid avatar size and spoofed format show an immediate error and block Save profile', async () => {
  const f = await form();
  for (const [file, message] of [
    [new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'large.jpg', { type: 'image/jpeg' }), /smaller than 2 MB/],
    [new File(['not a photograph'], 'fake.jpg', { type: 'image/jpeg' }), /JPEG, PNG, or WebP/],
  ]) {
    await f.select(file);
    const rendered = f.render();
    assert.match(rendered.find(n => n.props?.id === 'photo-error').props.children, message);
    assert.equal(rendered.find(n => n.type === 'button' && n.props.type === 'submit').props.disabled, true);
    assert.equal(rendered.some(n => n.type === 'img'), false);
    assert.equal(f.saves(), 0);
  }
});
