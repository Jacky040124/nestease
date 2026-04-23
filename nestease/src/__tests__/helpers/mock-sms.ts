/** SMS spy — records all sendSMS calls for assertion in tests. */

export interface SMSCall {
  to: string;
  body: string;
}

export const smsSpy = {
  calls: [] as SMSCall[],

  reset() {
    this.calls = [];
  },

  lastCall(): SMSCall | undefined {
    return this.calls.at(-1);
  },

  findByContent(keyword: string): SMSCall[] {
    return this.calls.filter((c) => c.body.includes(keyword));
  },

  findByTo(phone: string): SMSCall[] {
    return this.calls.filter((c) => c.to === phone);
  },
};
