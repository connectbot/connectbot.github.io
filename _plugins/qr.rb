module Jekyll
  class QrCodeTag < Liquid::Tag
    require 'rqrcode_png'

    def initialize(tag_name, url, tokens)
      super
      @url = url.strip
    end

    def render(context)
      qr = RQRCode::QRCode.new(@url)
      png = qr.to_img
      w, h = png.width, png.height
      png = png.resize(w*2, h*2)
      <<-MARKUP.strip
      <div class="qrcode">
        <img src="#{png.to_data_url}" alt="#{@url}">
      </div>
      MARKUP
    end
  end
end

Liquid::Template.register_tag('qr', Jekyll::QrCodeTag)
