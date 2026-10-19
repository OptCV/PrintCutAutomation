# VectorCraft command surface used by Print/Cut Direct

Always run:

```powershell
bun run doctor
```

after installing or updating VectorCraft. The doctor queries the live
`engine.commands` registry and prints the current parameter documentation.

Engine commands used:

- `file.new`
- `file.place`
- `file.place.info`
- `layer.new`
- `layer.setCurrent`
- `layer.setProps`
- `layer.delete`
- `shape.rectangle`
- `shape.ellipse`
- `paint.setFill`
- `paint.setStroke`
- `stroke.set`
- `select.set`
- `object.rotate`
- `object.clippingMask.make`
- `file.close`

Control methods used:

- `engine.commands`
- `engine.execute`
- `ui.inspect`
- `app.export`
- `ui.dialog.set`
- `ui.dialog.confirm`

The script communicates with VectorCraft as newline-delimited JSON over
`127.0.0.1:<controlPort>`.
