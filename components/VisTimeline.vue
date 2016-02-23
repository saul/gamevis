<script type="text/babel">
	export default {
		props: ['all', 'available'],
		replace: false,
		ready() {
			this.available = this.all;
		}
	}
</script>
