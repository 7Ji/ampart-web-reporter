const humanReadableSuffixes = "BKMGTPEZY"

function sizeToHumanReadable(size) {
    for (var i = 0; i < 9; ++i) {
        if (size < 1024) {
            return `${size}${humanReadableSuffixes[i]}`
        }
        size /= 1024
    }
    return `${size}BB`
}

const writables = {
    no: 0,
    partial: 1,
    yes: 2
}

function setWritable(cell, writable) {
    switch (writable) {
        case writables.no:
            cell.setAttribute("class", "tdNonWritable")
            break
        case writables.partial:
            cell.setAttribute("class", "tdPartialWritable")
            break
        case writables.yes:
            cell.setAttribute("class", "tdWritable")
            break
    }
}

class Partition {
    constructor(parg) {
        const pargParts = parg.split(":")
        this.name = pargParts[0]
        this.offset = Number(pargParts[1])
        this.size = Number(pargParts[2])
        this.masks = Number(pargParts[3])
    }

    fillCellsSize(size, allowNegative, decimal, hex, human) {
        if (size < 0) {
            if (allowNegative) {
                if (size == -1) {
                    decimal.textContent = "auto-fill"
                    hex.textContent = "auto-fill"
                    human.textContent = "auto-fill"
                }
            }
        } else {
            decimal.textContent = size
            hex.textContent = size.toString(16)
            human.textContent = sizeToHumanReadable(size)
        }
    }

    fillRowName(row) {
        const cellName = row.insertCell()
        cellName.setAttribute("class", "tcName")
        cellName.textContent = this.name
    }

    fillRowOffset(row) {
        const cellOffsetDecimal = row.insertCell()
        const cellOffsetHex = row.insertCell()
        const cellOffsetHuman = row.insertCell()
        this.fillCellsSize(this.offset, false, cellOffsetDecimal, cellOffsetHex, cellOffsetHuman)
    }

    fillRowSize(row) {
        const cellSizeDecimal = row.insertCell()
        const cellSizeHex = row.insertCell()
        const cellSizetHuman = row.insertCell()
        this.fillCellsSize(this.size, true, cellSizeDecimal, cellSizeHex, cellSizetHuman)
    }

    fillRowMasks(row) {
        const cellMasks = row.insertCell()
        cellMasks.textContent = this.masks
    }
}

class DPartition extends Partition {
    constructor(parg) {
        if (reDParg.test(parg)) {
            super(parg)
        } else {
            throw new Error("Failed to parse DTB parg")
        }
    }
    
    fillRow(row) {
        this.fillRowName(row)
        this.fillRowSize(row)
        this.fillRowMasks(row)
    }
}

class EPartition extends Partition {
    constructor(parg) {
        if (reEParg.test(parg)) {
            super(parg)
        } else {
            throw new Error("Failed to parse DTB parg")
        }
    }

    fillRow(row) {
        this.fillRowName(row)
        this.fillRowOffset(row)
        this.fillRowSize(row)
        this.fillRowMasks(row)
        const cellWritable = row.insertCell()
        var content = ""
        var writable = 0
        switch (this.name) {
            case 'bootloader':
            case 'reserved':
                content = "no"
                writable = writables.no
                break
            case 'env':
                content = "yes only after first 1M"
                writable = writables.partial
                break
            case 'logo':
                content = "yes if you don't need logo"
                writable = writables.partial
                break
            default:
                content  = "yes"
                writable = writables.yes
                break
        }
        cellWritable.textContent = content
        setWritable(cellWritable, writable)
    }
}

class Table {
    constructor(snapshot) {
        this.snapshot = snapshot
        this.pargs = snapshot.split(" ")
    }

    addRowGap(table, start, end) {
        var diff = 0
        var gap = false
        if (start > end) {
            diff = start - end
            gap = true
        } else if (start < end) {
            diff = end - start
        } else {
            throw new Error("Gap does not accept 0 size")
        }
        const rowGap = table.insertRow()
        rowGap.setAttribute("class", "trGap")
        const cellName = rowGap.insertCell()
        if (gap) {
            cellName.textContent = "gap"
        }
        else {
            cellName.textContent = "overlap"
        }
        for (var i = 0; i < 3; ++i) {
            rowGap.insertCell()
        }
        const cellSizeDecimal = rowGap.insertCell()
        cellSizeDecimal.textContent = `${diff}`
        const cellSizeHex = rowGap.insertCell()
        cellSizeHex.textContent = `${diff.toString(16)}`
        const cellSizetHuman = rowGap.insertCell()
        cellSizetHuman.textContent = `${sizeToHumanReadable(diff)}`
        rowGap.insertCell()
        const cellWritable = rowGap.insertCell()
        cellWritable.textContent = "yes"
        setWritable(cellWritable, writables.yes)
    }

    updateTable(pId, tbId, gap) {
        const pDSnapshot = document.getElementById(pId)
        pDSnapshot.textContent = this.snapshot
        const table = document.getElementById(tbId)
        table.removeChild(table.firstElementChild)
        var lastEnd = 0
        for (const part of this.parts) {
            if (gap && part.offset != lastEnd) {
                this.addRowGap(table, part.offset, lastEnd)
            }
            const rowNew = table.insertRow()
            part.fillRow(rowNew)
            lastEnd = part.offset + part.size
        }
    }
}

class DTable extends Table {
    constructor(snapshot) {
        super(snapshot)
        this.parts = []
        for (const parg of this.pargs) {
            this.parts.push(new DPartition(parg))
        }
    }

    show() {
        this.updateTable("pDSnapshot", "tbDTB", false)
    }
}

class ETable extends Table {
    constructor(snapshot) {
        super(snapshot)
        this.parts = []
        for (const parg of this.pargs) {
            this.parts.push(new EPartition(parg))
        }
    }

    show() {
        this.updateTable("pESnapshot", "tbEPT", true)
    }
}

// Prepare parameters
const queryString = window.location.search
const urlParams = new URLSearchParams(queryString);
const dSnapshot = urlParams.get("dsnapshot")
const eSnapshot = urlParams.get("esnapshot")
const reDSnapshot = new RegExp(/^([a-zA-Z-_]+::(-1|[0-9]+):[0-9]+ )*[a-zA-Z-_]+::(-1|[0-9]+):[0-9]+$/)
const reESnapshot = new RegExp(/^([a-zA-Z-_]+:[0-9]+:[0-9]+:[0-9]+ )*[a-zA-Z-_]+:[0-9]+:[0-9]+:[0-9]+$/)
const reDParg = new RegExp(/^[a-zA-Z-_]+::(-1|[0-9]+):[0-9]+$/)
const reEParg = new RegExp(/^[a-zA-Z-_]+:[0-9]+:[0-9]+:[0-9]+$/)

// console.log(dSnapshot)
if (dSnapshot && reDSnapshot.test(dSnapshot)) {
    const dTable = new DTable(dSnapshot)
    dTable.show()
}
console.log(eSnapshot)
if (eSnapshot && reESnapshot.test(eSnapshot)) {
    const eTable = new ETable(eSnapshot)
    eTable.show()
}