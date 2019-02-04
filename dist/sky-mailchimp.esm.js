import approve from 'approvejs';
import axios from 'axios';
import _merge from 'lodash.merge';

var SkyMailchimpState = {};

// import Vue from 'vue';

var elements = {};

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
	var isApproved = approve.value(el.value.trim(), ruleSet).approved;
	SkyMailchimpState[el.name] = isApproved;

	return isApproved;
}

var SkyApprove = {
	name: 'sky-approve',
	inserted: function inserted(el, binding) {
		var rules = {};

		elements[binding.value] = {};

		if (el.type === 'email') {
			rules.email = true;
		}

		rules.required = el.required;

		elements[binding.value] = rules;

		setAttribute(el.parentNode);
		setResult(el, elements[binding.value]);
	},
	componentUpdated: function componentUpdated(el, binding) {
		var isApproved = setResult(el, elements[binding.value]);

		!isApproved
			? setAttribute(el.parentNode)
			: removeAttribute(el.parentNode);
	},
	unbind: function unbind(el, binding) {
		delete elements[binding.value];
	},
};

/**
 * TODO: Implementer sky-form når denne er færdig
 */

var defaultTexts = {
	teaser: '',
	submitted: {
		header: 'Dine oplysninger er sendt.',
		created: 'Du modtager en mail, hvor du skal bekræfte din tilmelding.',
		updated: 'Din profil er blevet opdateret.',
	},
	error: {
		header: 'Der skete en fejl.',
		description: 'Prøv igen senere.',
	},
	status: {
		hasSubscription: 'Din e-mail er allerede tilknyttet et eksisterende abonnement.',
		updateLinkSent: 'Af sikkerhedshensyn har vi sendt dig en e-mail med et link, som du skal aktivere for at ændre dine tilmeldinger.',
	},
	button: {
		checkMail: 'Tjek email',
		updateLink: 'Fjern eller tilføj nye emner til dit abonnement',
		submit: 'Tilmeld',
	},
	loadingText: {
		fetchTemplate: 'Vent, mens vi gør klar til din tilmelding…',
		checkMail: 'Vi undersøger, om du allerede abonnerer på et af vores nyhedsbreve…',
		submit: 'Indsender indtastet information…',
		requestUpdateLink: 'Vi er i fuld gang med at skrive en mail til dig…',
		default: 'Behandler data…',
	},
};

var defaultForm = {
	email: {
		id: Math.random().toString(35).substr(2, 5),
		type: 'email',
		name: 'email',
		placeholder: '',
		required: true,
		pattern: '.+@.+\..{1,63}',
		disabled: false,
		checked: false,
		readonly: false,
		value: '',
		label: '',
		helpText: '',
		error: '',
		showLabel: true,
	},
};

var script = {
	name: 'SkyMailchimp',
	directives: { SkyApprove: SkyApprove },
	props: {
		contextid: [String, Number],
		listid: [String, Number],
		action: String,
		advanced: {
			type: Boolean,
			default: false,
		},
		text: Object,
		form: Object,
	},
	data: function data() {
		return {
			merged: {
				text: _merge({}, defaultTexts, this.text),
				form: _merge({}, defaultForm, this.form),
			},
			mailchimp: {
				contextId: this.contextid,
				listId: this.listid,
			},
			apiEndpoints: {
				action: this.action || '/umbraco/api/MailChimpSubscriberApi/PostSubscriber',
				getTemplate: '/umbraco/api/skymailchimp/GetTemplate/',
				getSubscriber: '/umbraco/api/skymailchimp/GetSubscriber/',
				sendUpdateLink: '/umbraco/api/skymailchimp/SendUpdateLink/',
			},
			currentStep: null,
			states: {
				requestedUpdateLink: false,
				unauthorized: false,
				mailChecked: false,
				requestType: null,
				submitted: false,
				loading: false,
				success: false,
				error: false,
			},
		};
	},
	computed: {
		loaderText: function loaderText() {
			return this.states.requestType
				? this.merged.text.loadingText[this.states.requestType]
				: this.merged.text.loadingText.default;
		},
		feedbackText: function feedbackText() {
			if (this.states.success) {
				return {
					header: this.merged.text.submitted.header,
					description: this.mailchimp.existingUser
						? this.merged.text.submitted.updated
						: this.merged.text.submitted.created,
				};
			}

			return {
				header: this.merged.text.error.header,
				description: this.merged.text.error.description,
			};
		},
		buttonObject: function buttonObject() {
			return this.advanced
				? this.merged.text.button
				: { submit: this.merged.text.button.submit };
		},
	},
	beforeMount: function beforeMount() {
		var this$1 = this;

		if (this.advanced) {
			// Necessary for utilizing v-model on v-if input
			// Does not work in mounted hook
			Object.keys(this.merged.form).forEach(function (key) {
				this$1.$set(this$1.mailchimp, this$1.merged.form[key].name, null);
			});
		}
	},
	mounted: function mounted() {
		var this$1 = this;

		if (this.advanced) {
			var searchString = window.location.search;

			// console.log(decodeURI(searchString), 'ASDSD', decodeURIComponent(searchString));
			if (searchString) {
				this.implementQueryInfomation(decodeURIComponent(searchString));

				// If there is a searchString checkmail on next tick
				// giving v-sky-approve time for checking the new data from URL search query
				this.$nextTick(function () {
					this$1.checkMail();
				});
			} else {
				this.fetchTemplate();
			}
		} else {
			this.currentStep = 'submit';
		}
	},
	methods: {
		buttonHub: function buttonHub(callback) {
			// if advanced is not selected ALWAYS submit
			this.advanced
				? this[callback]()
				: this.submit();
		},
		fetch: function fetch(url, params) {
			return axios.get(url, { params: params });
		},
		fetchTemplate: function fetchTemplate() {
			var this$1 = this;

			this.states.loading = true;
			this.states.requestType = 'fetchTemplate';

			this.fetch(this.apiEndpoints.getTemplate, this.mailchimp)
				.then(function (res) {
					Object.assign(res.data, this$1.mailchimp);
					this$1.currentStep = 'checkMail';
				})
				.then(function () {
					this$1.states.loading = false;
				});
		},
		implementQueryInfomation: function implementQueryInfomation(string) {
			var this$1 = this;

			// Insert id and mail info from url in mailchimp object
			var splitValue = null;
			var isMailOrId = null;
			var key = null;

			string.slice(1).split('&').forEach(function (item) {
				splitValue = item.split('=');
				key = splitValue[0];
				isMailOrId = key === 'email' || key === 'id';

				if (isMailOrId) {
					this$1.mailchimp[key] = splitValue[1];
				}
			});
		},
		initiateLoading: function initiateLoading(requestType) {
			this.states.loading = true;
			this.states.requestType = requestType;
		},
		validatedForm: function validatedForm() {
			var errorAttributeOnForm = this.$refs.formElement.getAttribute('has-error');
			var errorPresent = !!Object.keys(SkyMailchimpState)
				.find(function (key) { return SkyMailchimpState[key] === false; });

			if (this.mailchimp.groups) {
				var nodelist = this.$el.querySelectorAll('.checkboxes');

				// Check if any checkbox is selected
				var checkboxSelected = this.mailchimp.groups.reduce(function (acc, cur) {
					cur.items.forEach(function (checkbox) {
						acc = checkbox.checked || acc;
					});

					return acc;
				}, false);

				if (!checkboxSelected) {
					// If no checkbox is selected set errorPresent to true
					errorPresent = true;

					for (var i = 0; i < nodelist.length; i++) {
						nodelist[i].setAttribute('has-error', '');
					}
				} else {
					for (var i$1 = 0; i$1 < nodelist.length; i$1++) {
						nodelist[i$1].removeAttribute('has-error');
					}
				}
			}

			if (errorPresent) {
				if (!errorAttributeOnForm) {
					this.$refs.formElement.setAttribute('has-error', '');
				}
			} else if (errorAttributeOnForm !== null) {
				this.$refs.formElement.removeAttribute('has-error');
			}

			return !errorPresent;
		},
		requestUpdateLink: function requestUpdateLink() {
			var this$1 = this;

			this.initiateLoading('requestUpdateLink');

			var ref = this.mailchimp;
			var contextId = ref.contextId;
			var listId = ref.listId;
			var email = ref.email;

			axios.get(this.apiEndpoints.sendUpdateLink, {
				params: {
					contextId: contextId,
					listId: listId,
					email: email,
				},
			})
				.then(function () {
					this$1.states.requestedUpdateLink = true;
				})
				.then(function () {
					this$1.states.loading = false;
				});
		},
		checkMail: function checkMail() {
			var this$1 = this;

			if (this.validatedForm()) {
				this.initiateLoading('checkMail');

				// Adding subscriberId only if present in URL
				var ref = this.mailchimp;
				var listId = ref.listId;
				var contextId = ref.contextId;
				var email = ref.email;
				var id = ref.id;

				var params = id === undefined
					? { listId: listId, contextId: contextId, email: email }
					: { listId: listId, contextId: contextId, email: email, subscriberId: id };

				this.fetch(this.apiEndpoints.getSubscriber, params)
					.then(function (res) {
						Object.assign(this$1.mailchimp, res.data);

						this$1.currentStep = 'submit';
						this$1.mailChecked = true;
					}, function (err) {
						if (err.response && err.response.status) {
							this$1.states.unauthorized = err.response.status === 401;
							this$1.currentStep = 'updateLink';
							this$1.mailChecked = true;
						}
					})
					.then(function () {
						this$1.states.loading = false;
					});
			}
		},
		submit: function submit() {
			var this$1 = this;

			if (this.validatedForm()) {
				this.initiateLoading('submit');

				axios({
					url: this.apiEndpoints.action,
					method: 'POST',
					data: this.mailchimp,
					headers: {
						'Content-Type': 'application/json',
					},
				}).then(function () {
					this$1.states.success = true;
				}, function () {
					this$1.states.error = true;
				}).then(function () {
					this$1.states.submitted = true;
					this$1.states.loading = false;
				});
			}
		},
		toggleCheckbox: function toggleCheckbox(groupId, index) {
			var this$1 = this;

			// TODO: Can this be refactored to use v-model in vue?
			this.mailchimp.groups.forEach(function (group, groupIndex) {
				if (group.id === groupId) {
					var clickedCheckBox = this$1.mailchimp.groups[groupIndex].items[index];
					this$1.$set(clickedCheckBox, 'checked', !clickedCheckBox.checked);
				}
			});

			this.validatedForm();
		},
	},
};

/* script */
            var __vue_script__ = script;
/* template */
var __vue_render__ = function () {var _vm=this;var _h=_vm.$createElement;var _c=_vm._self._c||_h;return _c('div',{staticClass:"sky-mailchimp"},[(!_vm.states.submitted)?_c('div',{staticClass:"sky-mailchimp-signup"},[(_vm.merged.text.teaser)?_c('p',{staticClass:"teaser",domProps:{"textContent":_vm._s(_vm.merged.text.teaser)}}):_vm._e(),_vm._v(" "),_c('form',{ref:"formElement",attrs:{"novalidate":""}},[_vm._l((_vm.merged.form),function(input){return (input.type === 'email' || _vm.currentStep === 'submit')?_c('div',{key:input.name,ref:((input.name) + "Parent"),refInFor:true,staticClass:"form-group"},[((input.type)==='checkbox')?_c('input',{directives:[{name:"model",rawName:"v-model",value:(_vm.mailchimp[input.name]),expression:"mailchimp[input.name]"},{name:"sky-approve",rawName:"v-sky-approve",value:(input.id || input.name),expression:"input.id || input.name"}],ref:input.name,refInFor:true,attrs:{"name":input.name,"placeholder":input.placeholder,"required":input.required,"disabled":((_vm.states.unauthorized) && (input.type === 'email')) || ((input.type === 'email') && (_vm.currentStep === 'submit') && _vm.advanced),"type":"checkbox"},domProps:{"checked":Array.isArray(_vm.mailchimp[input.name])?_vm._i(_vm.mailchimp[input.name],null)>-1:(_vm.mailchimp[input.name])},on:{"change":function($event){var $$a=_vm.mailchimp[input.name],$$el=$event.target,$$c=$$el.checked?(true):(false);if(Array.isArray($$a)){var $$v=null,$$i=_vm._i($$a,$$v);if($$el.checked){$$i<0&&(_vm.$set(_vm.mailchimp, input.name, $$a.concat([$$v])));}else{$$i>-1&&(_vm.$set(_vm.mailchimp, input.name, $$a.slice(0,$$i).concat($$a.slice($$i+1))));}}else{_vm.$set(_vm.mailchimp, input.name, $$c);}}}}):((input.type)==='radio')?_c('input',{directives:[{name:"model",rawName:"v-model",value:(_vm.mailchimp[input.name]),expression:"mailchimp[input.name]"},{name:"sky-approve",rawName:"v-sky-approve",value:(input.id || input.name),expression:"input.id || input.name"}],ref:input.name,refInFor:true,attrs:{"name":input.name,"placeholder":input.placeholder,"required":input.required,"disabled":((_vm.states.unauthorized) && (input.type === 'email')) || ((input.type === 'email') && (_vm.currentStep === 'submit') && _vm.advanced),"type":"radio"},domProps:{"checked":_vm._q(_vm.mailchimp[input.name],null)},on:{"change":function($event){_vm.$set(_vm.mailchimp, input.name, null);}}}):_c('input',{directives:[{name:"model",rawName:"v-model",value:(_vm.mailchimp[input.name]),expression:"mailchimp[input.name]"},{name:"sky-approve",rawName:"v-sky-approve",value:(input.id || input.name),expression:"input.id || input.name"}],ref:input.name,refInFor:true,attrs:{"name":input.name,"placeholder":input.placeholder,"required":input.required,"disabled":((_vm.states.unauthorized) && (input.type === 'email')) || ((input.type === 'email') && (_vm.currentStep === 'submit') && _vm.advanced),"type":input.type},domProps:{"value":(_vm.mailchimp[input.name])},on:{"input":function($event){if($event.target.composing){ return; }_vm.$set(_vm.mailchimp, input.name, $event.target.value);}}}),_vm._v(" "),(input.showLabel)?_c('label',{attrs:{"for":input.name},domProps:{"textContent":_vm._s(input.label)}}):_vm._e(),_vm._v(" "),_c('span',{staticClass:"help-block",domProps:{"textContent":_vm._s(input.helpText)}}),_vm._v(" "),_c('span',{staticClass:"text-danger",domProps:{"textContent":_vm._s(input.error)}})]):_vm._e()}),_vm._v(" "),_vm._l((_vm.mailchimp.groups),function(group,gIndex){return (_vm.advanced && _vm.currentStep === 'submit')?_c('div',{key:group.id,staticClass:"form-group checkboxes"},[(group.name)?_c('label',{domProps:{"textContent":_vm._s(group.name)}}):_vm._e(),_vm._v(" "),_c('div',{staticClass:"checkboxes"},_vm._l((group.items),function(checkbox,cIndex){return _c('div',{key:cIndex,staticClass:"checkbox"},[_c('input',{attrs:{"type":"checkbox"},domProps:{"checked":checkbox.checked},on:{"click":function($event){_vm.toggleCheckbox(group.id, cIndex);}}}),_vm._v(" "),_c('label',{domProps:{"textContent":_vm._s(checkbox.value)}})])})),_vm._v(" "),_c('span',{staticClass:"text-danger",domProps:{"textContent":_vm._s('Vælg min. et nyhedsbrev.')}})]):_vm._e()}),_vm._v(" "),(_vm.states.unauthorized)?_c('div',{staticClass:"form-group"},[(!_vm.states.requestedUpdateLink)?_c('span',[_vm._v("\n\t\t\t\t\t"+_vm._s(_vm.merged.text.status.hasSubscription)),_c('br'),_vm._v(" "),_c('a',{staticClass:"sky-mailchimp-request-link",attrs:{"href":""},domProps:{"textContent":_vm._s(_vm.buttonObject.updateLink)},on:{"click":function($event){$event.preventDefault();return _vm.requestUpdateLink($event)}}}),_vm._v(" "),_c('br')]):_vm._e(),_vm._v(" "),(_vm.states.requestedUpdateLink)?_c('span',{domProps:{"textContent":_vm._s(_vm.merged.text.status.updateLinkSent)}}):_vm._e()]):_vm._e(),_vm._v(" "),(!_vm.states.unauthorized)?_c('div',{staticClass:"form-group submit"},_vm._l((_vm.buttonObject),function(value,key){return (_vm.currentStep === key)?_c('button',{key:key,class:key,on:{"click":function($event){$event.preventDefault();_vm.buttonHub(key);}}},[_c('span',{domProps:{"textContent":_vm._s(value)}})]):_vm._e()})):_vm._e()],2)]):_vm._e(),_vm._v(" "),_c('div',{class:['sky-mailchimp-loader', {'show': _vm.states.loading}]},[_c('div',{staticClass:"sky-mailchimp-loader-wrap"},[_c('span',{staticClass:"sky-mailchimp-loader-content",domProps:{"textContent":_vm._s(_vm.loaderText)}})])]),_vm._v(" "),(_vm.states.submitted)?_c('div',{staticClass:"sky-mailchimp-feedback"},[_c('h2',{domProps:{"textContent":_vm._s(_vm.feedbackText.header)}}),_vm._v(" "),_c('p',{domProps:{"textContent":_vm._s(_vm.feedbackText.description)}})]):_vm._e()])};
var __vue_staticRenderFns__ = [];

  /* style */
  var __vue_inject_styles__ = undefined;
  /* scoped */
  var __vue_scope_id__ = undefined;
  /* module identifier */
  var __vue_module_identifier__ = undefined;
  /* functional template */
  var __vue_is_functional_template__ = false;
  /* component normalizer */
  function __vue_normalize__(
    template, style, script$$1,
    scope, functional, moduleIdentifier,
    createInjector, createInjectorSSR
  ) {
    var component = (typeof script$$1 === 'function' ? script$$1.options : script$$1) || {};

    // For security concerns, we use only base name in production mode.
    component.__file = "SkyMailchimp.vue";

    if (!component.render) {
      component.render = template.render;
      component.staticRenderFns = template.staticRenderFns;
      component._compiled = true;

      if (functional) { component.functional = true; }
    }

    component._scopeId = scope;

    return component
  }
  /* style inject */
  
  /* style inject SSR */
  

  
  var SkyMailchimp = __vue_normalize__(
    { render: __vue_render__, staticRenderFns: __vue_staticRenderFns__ },
    __vue_inject_styles__,
    __vue_script__,
    __vue_scope_id__,
    __vue_is_functional_template__,
    __vue_module_identifier__,
    undefined,
    undefined
  );

var defaults = {
	registerComponents: true,
};

function install(Vue, options) {
	if (install.installed === true) {
		return;
	}

	var ref = Object.assign({}, defaults, options);
	var registerComponents = ref.registerComponents;

	if (registerComponents) {
		Vue.component(SkyMailchimp.name, SkyMailchimp);
	}
}

export default install;
