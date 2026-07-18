export const ACHIEVEMENTS = [
  { id: 'about', title: 'Lore Unlocked', desc: 'Read the builder\'s origin story', xp: 10 },
  { id: 'stats', title: 'Character Sheet', desc: 'Inspected the player stats', xp: 10 },
  { id: 'skills', title: 'Skill Tree Mapped', desc: 'Explored the tech constellation', xp: 10 },
  { id: 'projects', title: 'Field Report', desc: 'Reviewed the shipped systems', xp: 15 },
  { id: 'timeline', title: 'Historian', desc: 'Walked the full journey', xp: 10 },
  { id: 'how-i-build', title: 'Architect', desc: 'Understood the build process', xp: 15 },
  { id: 'contact', title: 'Connection Made', desc: 'Reached the contact terminal', xp: 15 },
  { id: 'commander', title: 'Commander', desc: 'Opened the command palette', xp: 10 },
  { id: 'shapeshifter', title: 'Shapeshifter', desc: 'Switched the color grade', xp: 10 },
  { id: 'compiler', title: 'Compiler', desc: 'Fractured the construct', xp: 15 },
  { id: 'secret-found', title: 'Secret Operative', desc: 'Found the hidden protocol', xp: 20 },
  { id: 'high-scorer', title: 'High Scorer', desc: 'Scored 10+ in the hidden game', xp: 15 },
  { id: 'forge-master', title: 'Forge Master', desc: 'Collected all 5 hidden sparks', xp: 25 },
  { id: 'poke-master', title: 'Poke Master', desc: 'Poked the forge 5 times rapidly', xp: 10 },
]

export const TOTAL_XP = ACHIEVEMENTS.reduce((sum, a) => sum + a.xp, 0)

export function getAchievement(id) {
  return ACHIEVEMENTS.find((a) => a.id === id)
}
