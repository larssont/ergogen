const m = require('makerjs')
const bezier = require('./bezier')

exports.deepcopy = value => {
    if (value === undefined) return undefined
    return JSON.parse(JSON.stringify(value))
}

const deep = exports.deep = (obj, key, val) => {
    const levels = key.split('.')
    const last = levels.pop()
    let step = obj
    for (const level of levels) {
        step[level] = step[level] || {}
        step = step[level]
    }
    if (val === undefined) return step[last]
    step[last] = val
    return obj
}

exports.template = (str, vals={}) => {
    const regex = /\{\{([^}]*)\}\}/g
    let res = str
    let shift = 0
    for (const match of str.matchAll(regex)) {
        const replacement = (deep(vals, match[1]) || '') + ''
        res = res.substring(0, match.index + shift)
            + replacement
            + res.substring(match.index + shift + match[0].length)
        shift += replacement.length - match[0].length
    }
    return res
}

const eq = exports.eq = (a=[], b=[]) => {
    return a[0] === b[0] && a[1] === b[1]
}

const line = exports.line = (a, b) => {
    return new m.paths.Line(a, b)
}

exports.circle = (p, r) => {
    return {paths: {circle: new m.paths.Circle(p, r)}}
}

exports.rect = (w, h, o=[0, 0]) => {
    const res = {
        top:    line([0, h], [w, h]),
        right:  line([w, h], [w, 0]),
        bottom: line([w, 0], [0, 0]),
        left:   line([0, 0], [0, h])
    }
    return m.model.move({paths: res}, o)
}

exports.poly = (points, curves = []) => {
    let model = new m.models.ConnectTheDots(true, points)

    curves.forEach((curve, i) => {
        const curvePoints = points.slice(curve.start, curve.end + 1);

        const bezierModel = new m.models.BezierCurve(curvePoints, curve.accuracy);

        m.model.addModel(model, bezierModel, `bezier_${i}`);

        for (let i = curve.start + 1; i <= curve.end; i++) {
            delete model.paths[`ShapeLine${i}`];
        }
    });
    
    return model
}

const toCatmullRom = (points, alpha = 0.5) => {
    if (!Array.isArray(points) || points.length < 4 || !points.every(point => Array.isArray(point) && point.length === 2)) {
      throw new Error("Input must be an array of at least four points, each containing an x and y coordinate.");
    }
  
    if (![0, 0.5, 1].includes(alpha)) {
      throw new RangeError(`'alpha' should be: 0, 0.5, or 1. Got: ${alpha}`);
    }
  
    let p0, p1, p2, p3, bp1, bp2, d1, d2, d3, A, B, N, M;
    let d3powA, d2powA, d3pow2A, d2pow2A, d1pow2A, d1powA;
    let result = [];
  
    for (let i = 0; i < points.length - 1; i++) {
      p0 = i === 0 ? points[0] : points[i - 1];
      p1 = points[i];
      p2 = points[i + 1];
      p3 = i + 2 < points.length ? points[i + 2] : p2;
  
      d1 = Math.sqrt(Math.pow(p0[0] - p1[0], 2) + Math.pow(p0[1] - p1[1], 2));
      d2 = Math.sqrt(Math.pow(p1[0] - p2[0], 2) + Math.pow(p1[1] - p2[1], 2));
      d3 = Math.sqrt(Math.pow(p2[0] - p3[0], 2) + Math.pow(p2[1] - p3[1], 2));
  
      // Catmull-Rom to Cubic Bezier conversion matrix
      d3powA = Math.pow(d3, alpha);
      d3pow2A = Math.pow(d3, 2 * alpha);
      d2powA = Math.pow(d2, alpha);
      d2pow2A = Math.pow(d2, 2 * alpha);
      d1powA = Math.pow(d1, alpha);
      d1pow2A = Math.pow(d1, 2 * alpha);
  
      A = 2 * d1pow2A + 3 * d1powA * d2powA + d2pow2A;
      B = 2 * d3pow2A + 3 * d3powA * d2powA + d2pow2A;
      N = 3 * d1powA * (d1powA + d2powA);
  
      if (N > 0) N = 1 / N;
      M = 3 * d3powA * (d3powA + d2powA);
  
      if (M > 0) M = 1 / M;
  
      // Calculate control points
      bp1 = [
        (-d2pow2A * p0[0] + A * p1[0] + d1pow2A * p2[0]) * N,
        (-d2pow2A * p0[1] + A * p1[1] + d1pow2A * p2[1]) * N,
      ];
  
      bp2 = [
        (d3pow2A * p1[0] + B * p2[0] - d2pow2A * p3[0]) * M,
        (d3pow2A * p1[1] + B * p2[1] - d2pow2A * p3[1]) * M,
      ];
  
      // If the control points are the same as the points, leave them as is
      if (bp1[0] === 0 && bp1[1] === 0) bp1 = p1;
      if (bp2[0] === 0 && bp2[1] === 0) bp2 = p2;
  
      // Add the curve to the result array
      result.push([
        [bp1[0], bp1[1]],
        [bp2[0], bp2[1]],
        [p2[0], p2[1]],
      ]);
    }
  
    return result;
  };  

exports.bbox = (arr) => {
    let minx = Infinity
    let miny = Infinity
    let maxx = -Infinity
    let maxy = -Infinity
    for (const p of arr) {
        minx = Math.min(minx, p[0])
        miny = Math.min(miny, p[1])
        maxx = Math.max(maxx, p[0])
        maxy = Math.max(maxy, p[1])
    }
    return {low: [minx, miny], high: [maxx, maxy]}
}

const farPoint = exports.farPoint = [1234.1234, 2143.56789]

exports.union = exports.add = (a, b) => {
    return m.model.combine(a, b, false, true, false, true, {
        farPoint
    })
}

exports.subtract = (a, b) => {
    return m.model.combine(a, b, false, true, true, false, {
        farPoint
    })
}

exports.intersect = (a, b) => {
    return m.model.combine(a, b, true, false, true, false, {
        farPoint
    })
}

exports.stack = (a, b) => {
    return {
        models: {
            a, b
        }
    }
}

const semver = exports.semver = (str, name='') => {
    let main = str.split('-')[0]
    if (main.startsWith('v')) {
        main = main.substring(1)
    }
    while (main.split('.').length < 3) {
        main += '.0'
    }
    if (/^\d+\.\d+\.\d+$/.test(main)) {
        const parts = main.split('.').map(part => parseInt(part, 10))
        return {major: parts[0], minor: parts[1], patch: parts[2]}
    } else throw new Error(`Invalid semver "${str}" at ${name}!`)
}

const satisfies = exports.satisfies = (current, expected) => {
    if (current.major === undefined) current = semver(current)
    if (expected.major === undefined) expected = semver(expected)
    return current.major === expected.major && (
        current.minor > expected.minor || (
            current.minor === expected.minor && 
            current.patch >= expected.patch
        )
    )
}