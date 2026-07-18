import { motion } from 'framer-motion'

const FACE_ROTATIONS = {
  1: { rotateX: 0, rotateY: 0 },
  2: { rotateX: 0, rotateY: -90 },
  3: { rotateX: 0, rotateY: -180 },
  4: { rotateX: 0, rotateY: 90 },
  5: { rotateX: -90, rotateY: 0 },
  6: { rotateX: 90, rotateY: 0 },
}

const DOT_PATTERNS = {
  1: [[1, 1]],
  2: [[0, 0], [2, 2]],
  3: [[0, 0], [1, 1], [2, 2]],
  4: [[0, 0], [0, 2], [2, 0], [2, 2]],
  5: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]],
  6: [[0, 0], [0, 2], [1, 0], [1, 2], [2, 0], [2, 2]],
}

function Face({ value }) {
  const dots = DOT_PATTERNS[value]
  return (
    <div className="dice-3d__grid">
      {dots.map(([r, c], i) => (
        <span
          key={i}
          className="dice-3d__dot"
          style={{ gridRow: r + 1, gridColumn: c + 1 }}
        />
      ))}
    </div>
  )
}

export default function Dice3D({ value, rolling }) {
  const target = value ? FACE_ROTATIONS[value] : FACE_ROTATIONS[1]
  const spinX = rolling ? target.rotateX + 720 : target.rotateX
  const spinY = rolling ? target.rotateY + 1080 : target.rotateY

  return (
    <div className="dice-3d">
      <motion.div
        className="dice-3d__cube"
        animate={{ rotateX: spinX, rotateY: spinY }}
        transition={{ duration: rolling ? 0.6 : 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="dice-3d__face dice-3d__face--1"><Face value={1} /></div>
        <div className="dice-3d__face dice-3d__face--2"><Face value={2} /></div>
        <div className="dice-3d__face dice-3d__face--3"><Face value={3} /></div>
        <div className="dice-3d__face dice-3d__face--4"><Face value={4} /></div>
        <div className="dice-3d__face dice-3d__face--5"><Face value={5} /></div>
        <div className="dice-3d__face dice-3d__face--6"><Face value={6} /></div>
      </motion.div>
    </div>
  )
}
