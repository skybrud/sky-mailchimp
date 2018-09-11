// import Vue from 'vue';
import approve from 'approvejs';
import SkyMailchimpState from './SkyMailchimp.state';

const elements = {};

function setAttribute(element) {
	if (element.getAttribute('has-error') === null) {
		element.setAttribute('has-error', '');
	}
}

function removeAttribute(element) {
	if (element.getAttribute('has-error') !== null) {
		element.removeAttribute('has-error');
	}
}

function setResult(el, ruleSet) {
	const isApproved = approve.value(el.value.trim(), ruleSet).approved;
	SkyMailchimpState[el.name] = isApproved;

	return isApproved;
}

export default {
	name: 'sky-approve',
	inserted(el, binding) {
		const rules = {};

		elements[binding.value] = {};

		if (el.type === 'email') {
			rules.email = true;
		}

		rules.required = el.required;

		elements[binding.value] = rules;

		setAttribute(el.parentNode);
		setResult(el, elements[binding.value]);
	},
	componentUpdated(el, binding) {
		const isApproved = setResult(el, elements[binding.value]);

		!isApproved
			? setAttribute(el.parentNode)
			: removeAttribute(el.parentNode);
	},
	unbind(el, binding) {
		delete elements[binding.value];
	},
};
