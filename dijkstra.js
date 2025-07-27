// utils/dijkstra.js
function haversine([lat1, lng1], [lat2, lng2]) {
    const toRad = deg => deg * Math.PI / 180;
    const R = 6371e3;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
  
  function dijkstra(graph, start, end) {
    const dist = new Map();
    const prev = new Map();
    const queue = new Set(Object.keys(graph));
  
    for (let node of queue) {
      dist.set(node, Infinity);
      prev.set(node, null);
    }
  
    dist.set(start, 0);
  
    while (queue.size) {
      let u = [...queue].reduce((a, b) => dist.get(a) < dist.get(b) ? a : b);
      queue.delete(u);
  
      if (u === end) break;
  
      for (const [v, cost] of graph[u]) {
        const alt = dist.get(u) + cost;
        if (alt < dist.get(v)) {
          dist.set(v, alt);
          prev.set(v, u);
        }
      }
    }
  
    const path = [];
    for (let at = end; at; at = prev.get(at)) {
      path.push(at);
    }
  
    return path.reverse().map(p => p.split(',').map(Number));
  }
  
  module.exports = { dijkstra, haversine };
  