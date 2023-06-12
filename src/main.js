import express from 'express'
import promClient from 'prom-client'
import mqtt from 'mqtt'

await main()

async function main() {
    const terminationSignal = abortOnTerminationSignal(['SIGINT', 'SIGTERM'])
    const app = express()
    promClient.collectDefaultMetrics()

    const windowStatus = new promClient.Gauge({
        name: 'window_status',
        help: 'window_status',
        labelNames: ['sensor'],
    })

    const mqttClient = mqtt.connect({
        port: process.env.MQTT_PORT,
        host: process.env.MQTT_HOST,
        path: process.env.MQTT_PATH,
        username: process.env.MQTT_USERNAME,
        password: process.env.MQTT_PASSWORD,
        protocol: process.env.MQTT_PROTOCOL,
    })

    terminationSignal.addEventListener('abort', () => {
        console.log('shutting down')
        mqttClient.end()
    })

    const topics = ['zigbee2mqtt/ikkuna/olohuone', 'zigbee2mqtt/ikkuna/makkari']

    mqttClient.on('connect', () => {
        console.log('Connected to mqtt server')
        for (const topic of topics) {
            mqttClient.subscribe(topic, (err) => {
                if (err) {
                    console.error(`Failed to subscribe to topic ${topic}`, err)
                } else {
                    console.log(`Subscribed to topic ${topic}`) 
                }
            })
        }
    })

    mqttClient.on('message', (topic, message) => {
        if (topics.includes(topic)) {
            const parsedMessage = JSON.parse(message.toString('utf8'))
            console.log('message', topic, )
            windowStatus.set({ sensor: topic }, parsedMessage.contact === true ? 1 : 0)
        } else {
            console.warn(`Message received on unexpected topic ${topic}`)
        }
    })

    app.get('/metrics', async (_, res, next) => {
        try {
            res.type('text/plain').send(await promClient.register.metrics())
        } catch (e) {
            next(e)
        }
    })

    app.use((_, res) => {
        res.sendStatus(404)
    })

    await startServer(app, 4000, terminationSignal)
}

function abortOnTerminationSignal(
  signals,
) {
  const controller = new AbortController()

  for (const signal of signals) {
    process.on(signal, () => controller.abort(signal))
  }

  return controller.signal
}

async function startServer(
  app,
  port,
  terminationSignal,
) {
  const server = await new Promise((resolve) => {
    const s = app.listen(port, () => resolve(s))
  })
    console.log(`Server started on port ${port}`)
  terminationSignal.addEventListener('abort', () => {
    server.close(() => {
      console.log('Server shut down successfully')
    })
  })
  return server
}

