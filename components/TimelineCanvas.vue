<template>
	<div v-el:container class="webgl-container">
		<canvas class="visualisation" v-el:canvas></canvas>
	</div>
</template>

<script type="text/babel">
	const THREE = window.require('three');
	const Stats = window.require('stats.js');

	export default {
		props: {
			camera: {
				twoWay: true
			},
			scene: {
				twoWay: true
			}
		},
		data() {
			return {
				canvas: null,
				renderer: null,
				stats: null
			}
		},
		methods: {
			render() {
				window.requestAnimationFrame(this.render.bind(this));

				this.stats.begin();
				this.$emit('render');
				this.renderer.render(this.scene, this.camera);
				this.stats.end();
			}
		},
		ready() {
			this.canvas = this.$els.canvas;

			// Transform coordinate system to use the Z axis as 'up'
			THREE.Object3D.DefaultUp.set(0, 0, 1);

			this.renderer = new THREE.WebGLRenderer({antialias: true, canvas: this.canvas});
			this.renderer.setSize(1024, 1024);
			this.renderer.setPixelRatio(window.devicePixelRatio);

			let camera = new THREE.OrthographicCamera(0, 1, 0, 1, -10000, 10000);
			this.camera = camera;

			let scene = new THREE.Scene();
			this.scene = scene;

			this.stats = new Stats();
			this.stats.setMode(0); // 0: fps, 1: ms, 2: mb

			// align top-left
			this.stats.domElement.style.position = 'absolute';
			this.stats.domElement.style.left = '0px';
			this.stats.domElement.style.top = '0px';

			this.$els.container.appendChild(this.stats.domElement);

			window.requestAnimationFrame(this.render.bind(this));
		}
	}
</script>

<style lang="less" rel="stylesheet/less">
	.webgl-container {
		position: relative;
	}
</style>
