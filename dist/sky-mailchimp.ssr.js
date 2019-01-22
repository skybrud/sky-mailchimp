'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var approve = _interopDefault(require('approvejs'));
var axios = _interopDefault(require('axios'));
var _merge = _interopDefault(require('lodash.merge'));

var SkyMailchimpState = {};

// import Vue from 'vue';

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

var SkyApprove = {
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

/**
 * TODO: Implementer sky-form når denne er færdig
 */

const defaultTexts = {
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

const defaultForm = {
	email: {
		id: Math.random().toString(35).substr(2, 5),
		type: 'email',
		name: 'email',
		placeholder: '',
		required: true,
		pattern: null,
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
	directives: { SkyApprove },
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
	data() {
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
		loaderText() {
			return this.states.requestType
				? this.merged.text.loadingText[this.states.requestType]
				: this.merged.text.loadingText.default;
		},
		feedbackText() {
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
		buttonObject() {
			return this.advanced
				? this.merged.text.button
				: { submit: this.merged.text.button.submit };
		},
	},
	beforeMount() {
		if (this.advanced) {
			// Necessary for utilizing v-model on v-if input
			// Does not work in mounted hook
			Object.keys(this.merged.form).forEach((key) => {
				this.$set(this.mailchimp, this.merged.form[key].name, null);
			});
		}
	},
	mounted() {
		if (this.advanced) {
			const searchString = window.location.search;

			// console.log(decodeURI(searchString), 'ASDSD', decodeURIComponent(searchString));
			if (searchString) {
				this.implementQueryInfomation(decodeURIComponent(searchString));

				// If there is a searchString checkmail on next tick
				// giving v-sky-approve time for checking the new data from URL search query
				this.$nextTick(() => {
					this.checkMail();
				});
			} else {
				this.fetchTemplate();
			}
		} else {
			this.currentStep = 'submit';
		}
	},
	methods: {
		buttonHub(callback) {
			// if advanced is not selected ALWAYS submit
			this.advanced
				? this[callback]()
				: this.submit();
		},
		fetch(url, params) {
			return axios.get(url, { params });
		},
		fetchTemplate() {
			this.states.loading = true;
			this.states.requestType = 'fetchTemplate';

			this.fetch(this.apiEndpoints.getTemplate, this.mailchimp)
				.then((res) => {
					Object.assign(res.data, this.mailchimp);
					this.currentStep = 'checkMail';
				})
				.then(() => {
					this.states.loading = false;
				});
		},
		implementQueryInfomation(string) {
			// Insert id and mail info from url in mailchimp object
			let splitValue = null;
			let isMailOrId = null;
			let key = null;

			string.slice(1).split('&').forEach((item) => {
				splitValue = item.split('=');
				key = splitValue[0];
				isMailOrId = key === 'email' || key === 'id';

				if (isMailOrId) {
					this.mailchimp[key] = splitValue[1];
				}
			});
		},
		initiateLoading(requestType) {
			this.states.loading = true;
			this.states.requestType = requestType;
		},
		validatedForm() {
			const errorAttributeOnForm = this.$refs.formElement.getAttribute('has-error');
			let errorPresent = !!Object.keys(SkyMailchimpState)
				.find(key => SkyMailchimpState[key] === false);

			if (this.mailchimp.groups) {
				const nodelist = this.$el.querySelectorAll('.checkboxes');

				// Check if any checkbox is selected
				const checkboxSelected = this.mailchimp.groups.reduce((acc, cur) => {
					cur.items.forEach((checkbox) => {
						acc = checkbox.checked || acc;
					});

					return acc;
				}, false);

				if (!checkboxSelected) {
					// If no checkbox is selected set errorPresent to true
					errorPresent = true;

					for (let i = 0; i < nodelist.length; i++) {
						nodelist[i].setAttribute('has-error', '');
					}
				} else {
					for (let i = 0; i < nodelist.length; i++) {
						nodelist[i].removeAttribute('has-error');
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
		requestUpdateLink() {
			this.initiateLoading('requestUpdateLink');

			const { contextId, listId, email } = this.mailchimp;

			axios.get(this.apiEndpoints.sendUpdateLink, {
				params: {
					contextId,
					listId,
					email,
				},
			})
				.then(() => {
					this.states.requestedUpdateLink = true;
				})
				.then(() => {
					this.states.loading = false;
				});
		},
		checkMail() {
			if (this.validatedForm()) {
				this.initiateLoading('checkMail');

				// Adding subscriberId only if present in URL
				const { listId, contextId, email, id } = this.mailchimp;

				const params = id === undefined
					? { listId, contextId, email }
					: { listId, contextId, email, subscriberId: id };

				this.fetch(this.apiEndpoints.getSubscriber, params)
					.then((res) => {
						Object.assign(this.mailchimp, res.data);

						this.currentStep = 'submit';
						this.mailChecked = true;
					}, (err) => {
						if (err.response && err.response.status) {
							this.states.unauthorized = err.response.status === 401;
							this.currentStep = 'updateLink';
							this.mailChecked = true;
						}
					})
					.then(() => {
						this.states.loading = false;
					});
			}
		},
		submit() {
			if (this.validatedForm()) {
				this.initiateLoading('submit');

				axios({
					url: this.apiEndpoints.action,
					method: 'POST',
					data: this.mailchimp,
					headers: {
						'Content-Type': 'application/json',
					},
				}).then(() => {
					this.states.success = true;
				}, () => {
					this.states.error = true;
				}).then(() => {
					this.states.submitted = true;
					this.states.loading = false;
				});
			}
		},
		toggleCheckbox(groupId, index) {
			// TODO: Can this be refactored to use v-model in vue?
			this.mailchimp.groups.forEach((group, groupIndex) => {
				if (group.id === groupId) {
					const clickedCheckBox = this.mailchimp.groups[groupIndex].items[index];
					this.$set(clickedCheckBox, 'checked', !clickedCheckBox.checked);
				}
			});

			this.validatedForm();
		},
	},
};

/* script */
            const __vue_script__ = script;
            
/* template */
var __vue_render__ = function () {var _vm=this;var _h=_vm.$createElement;var _c=_vm._self._c||_h;return _c('div',{staticClass:"sky-mailchimp"},[(!_vm.states.submitted)?_vm._ssrNode("<div class=\"sky-mailchimp-signup\">","</div>",[_vm._ssrNode(((_vm.merged.text.teaser)?("<p class=\"teaser\">"+_vm._ssrEscape(_vm._s(_vm.merged.text.teaser))+"</p>"):"<!---->")+" "),_vm._ssrNode("<form novalidate=\"novalidate\">","</form>",[_vm._l((_vm.merged.form),function(input){return (input.type === 'email' || _vm.currentStep === 'submit')?_vm._ssrNode("<div class=\"form-group\">","</div>",[((input.type)==='checkbox')?_c('input',{directives:[{name:"model",rawName:"v-model",value:(_vm.mailchimp[input.name]),expression:"mailchimp[input.name]"},{name:"sky-approve",rawName:"v-sky-approve",value:(input.id || input.name),expression:"input.id || input.name"}],ref:input.name,refInFor:true,attrs:{"name":input.name,"placeholder":input.placeholder,"required":input.required,"disabled":((_vm.states.unauthorized) && (input.type === 'email')) || ((input.type === 'email') && (_vm.currentStep === 'submit') && _vm.advanced),"type":"checkbox"},domProps:{"checked":Array.isArray(_vm.mailchimp[input.name])?_vm._i(_vm.mailchimp[input.name],null)>-1:(_vm.mailchimp[input.name])},on:{"change":function($event){var $$a=_vm.mailchimp[input.name],$$el=$event.target,$$c=$$el.checked?(true):(false);if(Array.isArray($$a)){var $$v=null,$$i=_vm._i($$a,$$v);if($$el.checked){$$i<0&&(_vm.$set(_vm.mailchimp, input.name, $$a.concat([$$v])));}else{$$i>-1&&(_vm.$set(_vm.mailchimp, input.name, $$a.slice(0,$$i).concat($$a.slice($$i+1))));}}else{_vm.$set(_vm.mailchimp, input.name, $$c);}}}}):((input.type)==='radio')?_c('input',{directives:[{name:"model",rawName:"v-model",value:(_vm.mailchimp[input.name]),expression:"mailchimp[input.name]"},{name:"sky-approve",rawName:"v-sky-approve",value:(input.id || input.name),expression:"input.id || input.name"}],ref:input.name,refInFor:true,attrs:{"name":input.name,"placeholder":input.placeholder,"required":input.required,"disabled":((_vm.states.unauthorized) && (input.type === 'email')) || ((input.type === 'email') && (_vm.currentStep === 'submit') && _vm.advanced),"type":"radio"},domProps:{"checked":_vm._q(_vm.mailchimp[input.name],null)},on:{"change":function($event){_vm.$set(_vm.mailchimp, input.name, null);}}},[]):_c('input',{directives:[{name:"model",rawName:"v-model",value:(_vm.mailchimp[input.name]),expression:"mailchimp[input.name]"},{name:"sky-approve",rawName:"v-sky-approve",value:(input.id || input.name),expression:"input.id || input.name"}],ref:input.name,refInFor:true,attrs:{"name":input.name,"placeholder":input.placeholder,"required":input.required,"disabled":((_vm.states.unauthorized) && (input.type === 'email')) || ((input.type === 'email') && (_vm.currentStep === 'submit') && _vm.advanced),"type":input.type},domProps:{"value":(_vm.mailchimp[input.name])},on:{"input":function($event){if($event.target.composing){ return; }_vm.$set(_vm.mailchimp, input.name, $event.target.value);}}},[]),_vm._ssrNode(" "+((input.showLabel)?("<label"+(_vm._ssrAttr("for",input.name))+">"+_vm._ssrEscape(_vm._s(input.label))+"</label>"):"<!---->")+" <span class=\"help-block\">"+_vm._ssrEscape(_vm._s(input.helpText))+"</span> <span class=\"text-danger\">"+_vm._ssrEscape(_vm._s(input.error))+"</span>")],2):_vm._e()}),_vm._ssrNode(" "+(_vm._ssrList((_vm.mailchimp.groups),function(group,gIndex){return (((_vm.advanced && _vm.currentStep === 'submit')?("<div class=\"form-group checkboxes\">"+((group.name)?("<label>"+_vm._ssrEscape(_vm._s(group.name))+"</label>"):"<!---->")+" <div class=\"checkboxes\">"+(_vm._ssrList((group.items),function(checkbox,cIndex){return ("<div class=\"checkbox\"><input type=\"checkbox\""+(_vm._ssrAttr("checked",checkbox.checked))+"> <label>"+_vm._ssrEscape(_vm._s(checkbox.value))+"</label></div>")}))+"</div> <span class=\"text-danger\">"+_vm._ssrEscape(_vm._s('Vælg min. et nyhedsbrev.'))+"</span></div>"):"<!---->"))}))+" "+((_vm.states.unauthorized)?("<div class=\"form-group\">"+((!_vm.states.requestedUpdateLink)?("<span>"+_vm._ssrEscape("\n\t\t\t\t\t"+_vm._s(_vm.merged.text.status.hasSubscription))+"<br> <a href class=\"sky-mailchimp-request-link\">"+_vm._ssrEscape(_vm._s(_vm.buttonObject.updateLink))+"</a> <br></span>"):"<!---->")+" "+((_vm.states.requestedUpdateLink)?("<span>"+_vm._ssrEscape(_vm._s(_vm.merged.text.status.updateLinkSent))+"</span>"):"<!---->")+"</div>"):"<!---->")+" "+((!_vm.states.unauthorized)?("<div class=\"form-group submit\">"+(_vm._ssrList((_vm.buttonObject),function(value,key){return (((_vm.currentStep === key)?("<button"+(_vm._ssrClass(null,key))+"><span>"+_vm._ssrEscape(_vm._s(value))+"</span></button>"):"<!---->"))}))+"</div>"):"<!---->"))],2)],2):_vm._e(),_vm._ssrNode(" <div"+(_vm._ssrClass(null,['sky-mailchimp-loader', {'show': _vm.states.loading}]))+"><div class=\"sky-mailchimp-loader-wrap\"><span class=\"sky-mailchimp-loader-content\">"+_vm._ssrEscape(_vm._s(_vm.loaderText))+"</span></div></div> "+((_vm.states.submitted)?("<div class=\"sky-mailchimp-feedback\"><h2>"+_vm._ssrEscape(_vm._s(_vm.feedbackText.header))+"</h2> <p>"+_vm._ssrEscape(_vm._s(_vm.feedbackText.description))+"</p></div>"):"<!---->"))],2)};
var __vue_staticRenderFns__ = [];

  /* style */
  const __vue_inject_styles__ = function (inject) {
    if (!inject) return
    inject("data-v-0d300d1d_0", { source: "\n.sky-mailchimp{position:relative\n}\n&:after{content:'';position:absolute;top:0;left:0;right:0;bottom:0;background-color:transparentize(#fff,.25)\n}\n.sky-mailchimp-loader-content{position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;flex-grow:0;width:100%;padding-top:$spinnerSize + 10px;text-align:center\n}\n@keyframes spinner{\nfrom{transform:rotate(0)\n}\nto{transform:rotate(360deg)\n}\n}", map: undefined, media: undefined });

  };
  /* scoped */
  const __vue_scope_id__ = undefined;
  /* module identifier */
  const __vue_module_identifier__ = "data-v-0d300d1d";
  /* functional template */
  const __vue_is_functional_template__ = false;
  /* component normalizer */
  function __vue_normalize__(
    template, style, script$$1,
    scope, functional, moduleIdentifier,
    createInjector, createInjectorSSR
  ) {
    const component = (typeof script$$1 === 'function' ? script$$1.options : script$$1) || {};

    // For security concerns, we use only base name in production mode.
    component.__file = "SkyMailchimp.vue";

    if (!component.render) {
      component.render = template.render;
      component.staticRenderFns = template.staticRenderFns;
      component._compiled = true;

      if (functional) component.functional = true;
    }

    component._scopeId = scope;

    {
      let hook;
      {
        // In SSR.
        hook = function(context) {
          // 2.3 injection
          context =
            context || // cached call
            (this.$vnode && this.$vnode.ssrContext) || // stateful
            (this.parent && this.parent.$vnode && this.parent.$vnode.ssrContext); // functional
          // 2.2 with runInNewContext: true
          if (!context && typeof __VUE_SSR_CONTEXT__ !== 'undefined') {
            context = __VUE_SSR_CONTEXT__;
          }
          // inject component styles
          if (style) {
            style.call(this, createInjectorSSR(context));
          }
          // register component module identifier for async chunk inference
          if (context && context._registeredComponents) {
            context._registeredComponents.add(moduleIdentifier);
          }
        };
        // used by ssr in case component is cached and beforeCreate
        // never gets called
        component._ssrRegister = hook;
      }

      if (hook !== undefined) {
        if (component.functional) {
          // register for functional component in vue file
          const originalRender = component.render;
          component.render = function renderWithStyleInjection(h, context) {
            hook.call(context);
            return originalRender(h, context)
          };
        } else {
          // inject component registration as beforeCreate hook
          const existing = component.beforeCreate;
          component.beforeCreate = existing ? [].concat(existing, hook) : [hook];
        }
      }
    }

    return component
  }
  /* style inject */
  
  /* style inject SSR */
  function __vue_create_injector_ssr__(context) {
    if (!context && typeof __VUE_SSR_CONTEXT__ !== 'undefined') {
      context = __VUE_SSR_CONTEXT__;
    }

    if (!context) return function () {}

    if (!context.hasOwnProperty('styles')) {
      Object.defineProperty(context, 'styles', {
        enumerable: true,
        get: () => context._styles
      });
      context._renderStyles = renderStyles;
    }

    function renderStyles(styles) {
      let css = '';
      for (const {ids, media, parts} of styles) {
        css +=
          '<style data-vue-ssr-id="' + ids.join(' ') + '"' + (media ? ' media="' + media + '"' : '') + '>'
          + parts.join('\n') +
          '</style>';
      }

      return css
    }

    return function addStyle(id, css) {
      const group = css.media || 'default';
      const style = context._styles[group] || (context._styles[group] = { ids: [], parts: [] });

      if (!style.ids.includes(id)) {
        style.media = css.media;
        style.ids.push(id);
        let code = css.source;
        style.parts.push(code);
      }
    }
  }

  
  var SkyMailchimp = __vue_normalize__(
    { render: __vue_render__, staticRenderFns: __vue_staticRenderFns__ },
    __vue_inject_styles__,
    __vue_script__,
    __vue_scope_id__,
    __vue_is_functional_template__,
    __vue_module_identifier__,
    undefined,
    __vue_create_injector_ssr__
  );

const defaults = {
	registerComponents: true,
};

function install(Vue, options) {
	if (install.installed === true) {
		return;
	}

	const { registerComponents } = Object.assign({}, defaults, options);

	if (registerComponents) {
		Vue.component(SkyMailchimp.name, SkyMailchimp);
	}
}

exports.default = install;
