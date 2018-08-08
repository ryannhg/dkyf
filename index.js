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
  messages: [],
  started: false
})

const person = (id, name) => ({
  id,
  name,
  ready: false
})

const getRoom = (id) =>
  Object.values(state.rooms)
    .filter(room => room.people.some(person => person.id === id))[0]

const getPersonInRoom = (room, id) =>
  room.people.filter(person => person.id === id)[0]

const joinRoom = (socket, name, player, id) => {
  const message = `${player} joined the room!`
  const room = state.rooms[name]
  room.people.push(person(id, player))
  room.messages.push(message)
  socket.join(name)
  io.in(name).emit('roomUpdated', room)
}

const createRoom = (socket, name, player, id) => {
  const message = `Room created by ${player}.`
  state.rooms[name] = room(name)
  state.rooms[name].people.push(person(id, player))
  state.rooms[name].messages.push(message)
  socket.join(name)
  socket.emit('roomUpdated', state.rooms[name])
}

const setPersonToReady = (room, id) => {
  const person = getPersonInRoom(room, id)
  person.ready = true
  return room
}

const setPersonToUnready = (room, id) => {
  const person = getPersonInRoom(room, id)
  person.ready = false
  return room
}

const everyoneIsReady = (room) =>
  room.people.every(person => person.ready)

const handlers = {
  connect: ({ id }) => {
    console.log('CONNECT', id)
  },
  disconnect: (socket) => () => {
    const id = socket.id
    console.log('DISCONNECT', id)
    const room = getRoom(id)
    if (room) {
      const person = getPersonInRoom(room, id)
      const message = `${person.name} left the room.`
      room.people = room.people.filter(person => person.id !== id)
      room.messages.push(message)
      if (room.people.length === 0) {
        console.log('REMOVING ROOM', room.name)
        delete state.rooms[room.name]
      } else {
        io.emit(room.name).emit('roomUpdated', state.rooms[room.name])
      }
    }
  },
  enterRoom: (socket) => ({ name, player }) => {
    const { id } = socket
    if (state.rooms[name]) {
      console.log('JOINING ROOM', id)
      joinRoom(socket, name, player, id)
    } else {
      console.log('CREATING ROOM', id)
      createRoom(socket, name, player, id)
    }
  },
  playerReady: (socket) => () => {
    const { id } = socket
    const room = getRoom(id)
    if (room) {
      console.log(`READY IN "${room.name}"`, id)
      const person = getPersonInRoom(room, id)
      state.rooms[room.name] = setPersonToReady(room, id)
      state.rooms[room.name].messages.push(`${person.name} is ready!`)
      if (everyoneIsReady(room)) {
        console.log(`STARTING GAME "${room.name}"`)
        state.rooms[room.name].started = true
      }
      io.emit('roomUpdated', room)
    }
  },
  playerUnready: (socket) => () => {
    const { id } = socket
    const room = getRoom(id)
    if (room) {
      console.log(`UNREADY IN "${room.name}"`, id)
      const person = getPersonInRoom(room, id)
      state.rooms[room.name] = setPersonToUnready(room, id)
      state.rooms[room.name].messages.push(`${person.name} is not ready!`)
      io.emit('roomUpdated', room)
    }
  }
}

io.on('connection', function (socket) {
  handlers.connect(socket)
  socket.on('enterRoom', handlers.enterRoom(socket))
  socket.on('playerReady', handlers.playerReady(socket))
  socket.on('playerUnready', handlers.playerUnready(socket))
  socket.on('disconnect', handlers.disconnect(socket))
})

server.listen(
  port,
  () => console.info(`Ready at http://localhost:${port}`)
)
