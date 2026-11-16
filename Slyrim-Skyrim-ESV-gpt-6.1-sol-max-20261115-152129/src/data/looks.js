// How people and monsters look (plan Part G.3, I.4): E.Humanoid options for each look id
export const LOOKS = {
  raider: { build: 'heroic', outfit: 'coat', cape: { len: 5, width: 5, seg: 2.5 }, hat: { style: 'furcap', color: '#5a4630' }, colors: { cloth: '#6a4a32', coat: '#5a3e28', pants: '#4a3a2a', boot: '#3a2a1c', cape: '#8a2a24', capeIn: '#5a1a16', skin: '#d09a73', hair: '#4a3020', metal: '#8a9098' } },
  hrolf: { build: 'bulky', outfit: 'coat', armor: true, cape: { len: 7, width: 6, seg: 2.8 }, hat: { style: 'horned', color: '#6a6e76' }, colors: { cloth: '#7a2a24', coat: '#4a3424', plate: '#7a7e86', pants: '#3a2a20', boot: '#2a2018', cape: '#5a2a1a', capeIn: '#3a1a10', skin: '#c08a68', hair: '#8a2e1e', metal: '#b0b8c0' } },
  dead: { build: 'skeleton', outfit: 'tunic', armor: true, hat: { style: 'helmet', color: '#7a5a2a' }, eyeGlow: '#8fd8ff', colors: { bone: '#b8c8d8', cloth: '#3a3a44', plate: '#8a6a3a', metal: '#a8783a', belt: '#5a4a30' } },
  lord: { build: 'skeleton', outfit: 'robe', armor: true, cape: { len: 8, width: 7, seg: 3 }, hat: { style: 'crown', color: '#a8783a' }, eyeGlow: '#8fd8ff', colors: { bone: '#a8b8cc', cloth: '#2a2a38', plate: '#8a6a3a', metal: '#c08a46', cape: '#2a2440', capeIn: '#1a1628' } },
  troll: { build: 'bulky', outfit: 'shirt', hunch: .5, colors: { skin: '#9aa4a8', cloth: '#7a7a70', pants: '#6a6a60', boot: '#5a5a54', hair: '#e8eef6', eye: '#3a1a10' } },
  giant: { build: 'bulky', outfit: 'tunic', hunch: .3, colors: { skin: '#c8a080', cloth: '#7a6a4a', pants: '#5a4a34', boot: '#4a3a28', hair: '#8a7a5a', belt: '#4a3420' } },
  guard: { build: 'heroic', outfit: 'tunic', armor: true, hat: { style: 'helmet', color: '#8c96a6' }, cape: { len: 5, width: 5, seg: 2.5 }, colors: { cloth: '#4a5a70', coat: '#3e4a5a', plate: '#8c96a6', pants: '#3a3a44', boot: '#2a2a30', cape: '#3e4a5a', capeIn: '#2a3240', skin: '#e8b996', metal: '#c6d0dc', trim: '#e8eef6' } },
  sigrun: { build: 'heroic', outfit: 'tunic', armor: true, hair: 'ponytail', colors: { cloth: '#5a4a3a', plate: '#8c96a6', pants: '#3a3430', boot: '#3a2a20', skin: '#e8b996', hair: '#d8b060', metal: '#c6d0dc' } },
  elder: { build: 'heroic', outfit: 'robe', hood: true, colors: { cloth: '#8a8a90', coat: '#6a6a70', hair: '#6a6a72', skin: '#e0b898' } }
};
