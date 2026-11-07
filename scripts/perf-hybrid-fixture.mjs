// Pure fixture construction: no saved state, Agent records or business IDs.
export function hybridPerformanceFixture(count, {domainFloors, departmentStarterRoom, parseRoomJSON}) {
  if (![4, 12].includes(count)) throw Error('Expected four or twelve characters');
  const current = domainFloors.find(floor => floor.key === 'customer');
  if (!current || current.roles.length !== 4) throw Error('Current 4-slot customer fixture changed; review the benchmark');
  const domain = count === 4 ? current : {label:'Synthetic 12-slot stress',number:1,roles:Array.from({length:12}, () => ({}))};
  const room = departmentStarterRoom(domain);
  const avatars = room.objects.filter(object => /^avatar-\d\d$/.test(object.kind));
  if (avatars.length !== count) throw Error('Fixture avatar count does not match');
  const appearances = ['zuri','wangjai','staff-a','staff-b'];
  avatars.forEach((object, index) => { object.appearance = appearances[index % appearances.length]; });
  return parseRoomJSON(JSON.stringify(room));
}
