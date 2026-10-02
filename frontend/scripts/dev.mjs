import http from 'node:http'
import { spawn } from 'node:child_process'

const port = 5174
const host = 'localhost'
const viteEntryMarker = '/src/main.tsx'

function existingServer() {
  return new Promise((resolve) => {
    const request = http.get({ host, port, path: '/', timeout: 2_000 }, (response) => {
      let body = ''
      response.setEncoding('utf8')
      response.on('data', (chunk) => { body += chunk })
      response.on('end', () => {
        resolve(response.statusCode === 200 && body.includes(viteEntryMarker) ? 'placenexus-vite' : 'other')
      })
    })

    request.on('timeout', () => request.destroy(new Error('Request timed out')))
    request.on('error', (error) => resolve(error.code === 'ECONNREFUSED' ? 'available' : 'other'))
  })
}

const status = await existingServer()

if (status === 'placenexus-vite') {
  console.log(`PlaceNexus frontend is already running at http://localhost:${port}; reusing it.`)
} else if (status === 'other') {
  console.error(`Port ${port} is occupied by a service that is not the PlaceNexus Vite server. Stop that intended process manually, then run npm run dev again.`)
  process.exitCode = 1
} else {
  const vite = spawn(process.platform === 'win32' ? 'vite.cmd' : 'vite', [], { stdio: 'inherit' })
  vite.on('error', (error) => {
    console.error(`Unable to start Vite: ${error.message}`)
    process.exitCode = 1
  })
  vite.on('exit', (code) => { process.exitCode = code ?? 1 })
}
