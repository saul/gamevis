const THREE = window.require('three');

/**
 * Overview mesh that is sized and positioned to cover an entire level.
 * Uses coordinates from the overview data.
 */
class OverviewMesh extends THREE.Mesh {
  /**
   * @param {OverviewData} overviewData
   * @param {ThreeMaterial} material
   */
  constructor(overviewData, material) {
    let geometry = new THREE.Geometry();

    geometry.vertices.push(new THREE.Vector3(0, 0, 0));
    geometry.vertices.push(new THREE.Vector3(1024, 0, 0));
    geometry.vertices.push(new THREE.Vector3(0, -1024, 0));
    geometry.vertices.push(new THREE.Vector3(1024, -1024, 0));

    geometry.faces.push(new THREE.Face3(0, 2, 1));
    geometry.faces.push(new THREE.Face3(2, 3, 1));

    geometry.faceVertexUvs[0].push(
      [new THREE.Vector2(0, 1), new THREE.Vector2(0, 0), new THREE.Vector2(1, 1)],
      [new THREE.Vector2(0, 0), new THREE.Vector2(1, 0), new THREE.Vector2(1, 1)]
    );

    // construct the mesh using the new geometry
    super(geometry, material);

    this.scale.set(overviewData.scale, overviewData.scale, 1);
    this.position.set(overviewData.pos_x, overviewData.pos_y, 0);
  }
}

module.exports = OverviewMesh;
