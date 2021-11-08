import videojs from 'video.js';
import axios from 'axios';

function getRandomId() {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  let nums = '';
  for (let i = 0; i < 32; i++) {
    const id = parseInt((Math.random() * 61).toString());
    nums += chars[id];
  }
  return nums;
}

const Html5 = videojs.getTech('Html5');

class WebRtc extends Html5 {
  [x: string]: any;
  rtc;
  signal_url;
  static canPlaySource: (techId: any, source: any) => any;
  static isSupported: () => any;

  setSrc(src) {
    if (this.rtc) {
      this.rtc.close();
      this.rtc = null;
    }

    this.signal_url = src;

    this.error_ = null;

    const offerSdpOption = {
      offerToReceiveAudio: true,
      offerToReceiveVideo: true,
    };

    this.rtc = new RTCPeerConnection({});
    this.rtc.addTransceiver('audio', { direction: 'recvonly' });
    this.rtc.addTransceiver('video', { direction: 'recvonly' });
    this.rtc.onicecandidate = function (event) {
      console.log('ICE candidate: \n' + (event.candidate ? event.candidate.candidate : '(null)'));
    };
    this.rtc.oniceconnectionstatechange = (event) => {
      if (this.rtc) {
        if (this.rtc.iceConnectionState == 'disconnected') {
          this.rtc.close();
          this.rtc = null;
        }
        console.log('ICE state: ' + this.rtc.iceConnectionState);
        console.log('ICE state change event: ', event);
      }
    };

    this.rtc.onaddstream = this.gotRemoteStream.bind(this);

    this.rtc
      .createOffer(offerSdpOption)
      .then((offer) => {
        console.log('createOffer:\n' + offer.sdp);
        console.log(this.rtc);

        this.rtc.setLocalDescription(offer);

        const version = 'v1.0';
        const sessionId = getRandomId();
        const url = this.signal_url;
        const request = {
          version: version,
          sessionId: sessionId,
          localSdp: offer,
        };

        const options = {
          url,
          method: 'POST',
          type: 'json',
          data: JSON.stringify(request),
        };

        //@ts-ignore
        axios(options)
          .then((result) => {
            console.log(result);
            this.play_success(result.data);
          })
          .catch((error) => {
            console.log(error);
          });
      })
      .catch(function (reason) {
        console.log('create offer failed, reason:' + reason);
      });
  }

  play_success(data) {
    if (data.code != 200) {
      console.log('play failed, code:' + data.code);
      stop();
      return;
    }

    const remoteSdp = data.remoteSdp;
    console.log('receive answer:\n' + remoteSdp.sdp);

    this.rtc.setRemoteDescription(
      new RTCSessionDescription(remoteSdp),
      function () {
        console.log('setRemoteDescription success!');
      },
      function (e) {
        console.log('setRemoteDescription failed, message:' + e.message);
      },
    );
  }

  gotRemoteStream(e) {
    this.el_.srcObject = e.stream;
    console.log('Received remote stream');
  }

  /**
   * @override {HTML5.currentSrc}
   */
  currentSrc() {
    if (this.signal_url) {
      return this.signal_url;
    }
    return this.el_.srcObject;
  }

  /**
   * @override {Html5.dispose}
   */
  dispose() {
    if (this.rtc) {
      this.rtc.close();
      this.rtc = null;
    }
    super.dispose();
  }
}

WebRtc.isSupported = function () {
  return true;
};

WebRtc.canPlaySource = function (source) {
  if (source.src.includes('.sdp')) {
    return 'maybe';
  }
  return '';
};

videojs.registerTech('webrtc', WebRtc);
export default WebRtc;