const path = require('path')
const express = require('express')
const app = express()
const server = require('http').Server(app)
const io = require('socket.io')(server)

const port = process.env.PORT || 3000

app.get('/', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')))

const state = {
  rooms: {}
}

const room = (name) => ({
  name,
  people: [],
  messages: []
})

const handlers = {
  connect: ({ id }) => {
  },
  disconnect: (socket) => () => {
    const id = socket.id
    const room = Object.values(state.rooms)
      .filter(room => room.people.some(person => person.id === id))[0]
    if (room) {
      const message = `${room.people.filter(person => person.id === id).map(person => person.name)[0]} left the room.`
      room.people = room.people.filter(person => person.id !== id)
      room.messages.push(message)
      socket.to(room.name).emit('messageReceived', message)
    }
  },
  enterRoom: (socket) => ({ name, player }) => {
    const { id } = socket
    if (state.rooms[name]) {
      const message = `${player} joined the room!`
      state.rooms[name].people.push({ id, name: player })
      state.rooms[name].messages.push(message)
      socket.join(name)
      socket.emit('roomEntered', state.rooms[name])
      socket.to(name).emit('messageReceived', message)
    } else {
      state.rooms[name] = room(name)
      state.rooms[name].people.push({ id, name: player })
      state.rooms[name].messages.push(`Room created by ${player}`)
      socket.join(name)
      socket.emit('roomEntered', state.rooms[name])
    }
  }
}

io.on('connection', function (socket) {
  handlers.connect(socket)
  socket.on('enterRoom', handlers.enterRoom(socket))
  socket.on('disconnect', handlers.disconnect(socket))
})

server.listen(
  port,
  () => console.info(`Ready at http://localhost:${port}`)
)
