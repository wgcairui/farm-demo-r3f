import { useRef, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { GLView, type ExpoWebGLRenderingContext } from 'expo-gl'
import { StatusBar } from 'expo-status-bar'
import * as THREE from 'three'
import { CROPS, stageOf } from '@farm/game'

// three r163+ 只走 WebGL2 路径，而 RN 环境没有 WebGL2RenderingContext 全局，
// expo-gl 的 context 具备 WebGL2 API 面，补一个空类让 three 的 instanceof 探测通过
if (typeof (globalThis as Record<string, unknown>).WebGL2RenderingContext === 'undefined') {
  ;(globalThis as Record<string, unknown>).WebGL2RenderingContext = class WebGL2RenderingContext {}
}

function onContextCreate(gl: ExpoWebGLRenderingContext) {
  const renderer = new THREE.WebGLRenderer({ context: gl as unknown as WebGLRenderingContext })
  renderer.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight)

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x87ceeb)
  const camera = new THREE.PerspectiveCamera(
    70,
    gl.drawingBufferWidth / gl.drawingBufferHeight,
    0.01,
    100,
  )
  camera.position.set(0, 1.2, 3)
  camera.lookAt(0, 0, 0)

  const cube = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0x2a4d3a }),
  )
  scene.add(cube)

  const light = new THREE.DirectionalLight(0xffffff, 2)
  light.position.set(2, 3, 4)
  scene.add(light)
  scene.add(new THREE.AmbientLight(0xffffff, 0.6))

  const render = () => {
    requestAnimationFrame(render)
    cube.rotation.x += 0.01
    cube.rotation.y += 0.013
    renderer.render(scene, camera)
    gl.endFrameEXP()
  }
  render()
}

export default function App() {
  const [glReady, setGlReady] = useState(false)
  const smoked = useRef(false)

  if (!smoked.current) {
    smoked.current = true
    // Phase 0 验收：@farm/game 在 RN 端可 import 且逻辑正确（控制台可见）
    const stage = stageOf({ crop: null, plantedAt: null }, Date.now())
    console.log(`[smoke] @farm/game stageOf(empty) = ${stage} | crops = ${Object.keys(CROPS).join(',')}`)
  }

  return (
    <View style={styles.container}>
      <StatusBar style="auto" />
      <GLView
        style={styles.gl}
        onContextCreate={(gl) => {
          onContextCreate(gl)
          setGlReady(true)
        }}
      />
      <Text style={styles.badge}>{glReady ? 'expo-gl ✓ three ✓' : 'starting GL…'}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  gl: { flex: 1 },
  badge: {
    position: 'absolute',
    top: 80,
    alignSelf: 'center',
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    overflow: 'hidden',
  },
})
