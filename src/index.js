import SkyMailchimp from './SkyMailchimp.vue';

const defaults = {
	registerComponents: true,
};

export default function install(Vue, options) {
	if (install.installed === true) {
		return;
	}

	const { registerComponents } = Object.assign({}, defaults, options);

	if (registerComponents) {
		Vue.component(SkyMailchimp.name, SkyMailchimp);
	}
};
