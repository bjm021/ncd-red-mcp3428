module.exports = class MCP3428{
	constructor(addr, comm, config, channel){
		//ensure config is an object
		if(typeof config != 'object') config = {};

		//extend with default values
		this.config = Object.assign({
			resolution: 12,
			gain: 1,
			mode: 1
		}, config);
		this.config.mode *= 1;
		//set default states and initialize
		this.comm = comm;
		this.channel = channel;
		this.addr = addr;
		this.initialized = false;
		this.status = {};
		this.raw = [];
		this.init();
	}
	configByte(ch){
		var gain = {"1": 0, "2": 1, "4": 2, "8": 3};
		ch <<= 5;
		return 128 | ch | ((this.config.resolution - 12) / 2) * 4 | gain[this.config.gain] | (this.config.mode << 4);
	}
	init(){
		//Run initialization routine for the chip
		this.comm.writeBytes(this.addr, this.configByte(this.channel)).then(() => {
			this.initialized = true;
		}).catch((err) => {
			this.initialized = false;
			console.log(err);
		});
	}
	get(ch, read, tries=0){
		if(this.config.mode == 0 && read !== true){
			return new Promise((fulfill, reject) => {
				var config = this.configByte(ch);
				this.comm.writeBytes(this.addr, config).then(() => {
					this.initialized = true;
					this.get(ch, true).then(fulfill).catch(reject);
				}).catch((err) => {
					this.initialized = false;
					console.log(err);
				});
			});
		}else{
			//Fetch the telemetry values from the chip
			return new Promise((fulfill, reject) => {
				this.comm.readBytes(this.addr, 3).then((r) => {
					this.initialized = true;
					if((r[2] & 128) == 0){
						var reading = (r[0] << 8) | r[1];
						reading &= (1 << this.config.resolution) - 1;
						var status = signInt(reading, this.config.resolution);
						fulfill(status);
					}else{
						if(tries > 5){
							reject('Timeout, no new data');
						}else{
							this.get(ch, true, tries++).then(fulfill).catch(reject);
						}
					}
				}).catch((err) => {
					this.initialized = false;
					reject(err);
				});
			});
		}
	}
};
function signInt(i, b){
	if(i.toString(2).length != b) return i;
	return -(((~i) & ((1 << (b-1))-1))+1);
}
