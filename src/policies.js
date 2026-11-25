// Các trang chính sách theo yêu cầu của Bộ Công Thương (NĐ 52/2013, NĐ 85/2021, TT 47/2014)
// và quy định bảo vệ dữ liệu cá nhân. Nội dung lấy thông tin cửa hàng từ Cài đặt.

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function build(s) {
  const name = esc(s.site_name);
  const owner = esc(s.biz_name || s.site_name);
  const addrs = String(s.address || '').split('|').map((x) => x.trim()).filter(Boolean);
  const hq = esc(s.biz_address || addrs[0] || '');
  const hotline = esc(s.hotline);
  const hotlines = [s.hotline, s.hotline2].filter(Boolean).map(esc).join(' – ');
  const email = s.email ? esc(s.email) : '';
  const contact = `hotline <b>${hotlines}</b> (Zalo)${email ? `, email <b>${email}</b>` : ''} hoặc trực tiếp tại cửa hàng: ${addrs.map(esc).join('; ')}`;
  const hours = esc(s.open_hours);
  const web = esc(String(s.website || '').replace(/^https?:\/\//, '').replace(/\/$/, ''));
  const days = parseInt(s.return_days, 10) || 7;
  const fee = Number(s.shipping_fee) || 0;
  const freeMin = Number(s.free_ship_min) || 0;
  const vnd = (n) => n.toLocaleString('vi-VN') + 'đ';
  const bank = s.bank_account ? `<p>Thông tin tài khoản nhận tiền: <b>${esc(s.bank_code)}</b> – số tài khoản <b>${esc(s.bank_account)}</b> – chủ tài khoản <b>${esc(s.bank_holder)}</b>. ${name} không yêu cầu chuyển khoản vào bất kỳ tài khoản nào khác.</p>` : `<p>Số tài khoản nhận tiền được hiển thị trên trang xác nhận đơn hàng (kèm mã VietQR) và chỉ là tài khoản đứng tên ${owner}. ${name} không yêu cầu chuyển khoản vào bất kỳ tài khoản nào khác.</p>`;

  const cartOn = s.cart_on === '1';
  return {
    'dieu-khoan': {
      title: 'Điều khoản & điều kiện giao dịch chung',
      body: `
<p>Website${web ? ` <b>${web}</b>` : ' này'} thuộc sở hữu của <b>${owner}</b>, địa chỉ trụ sở: ${hq}. Khi đặt hàng hoặc để lại thông tin trên website, quý khách đồng ý với các điều khoản dưới đây.</p>
<h2>1. Đối tượng áp dụng</h2>
<p>Áp dụng cho mọi khách hàng mua sản phẩm chăn, ga, gối, đệm và phụ kiện do ${name} bán thông qua website, điện thoại, Zalo hoặc tại cửa hàng sau khi xem sản phẩm trên website.</p>
<h2>2. Thông tin sản phẩm và giá</h2>
<ul>
<li>Hình ảnh, thông số (kích thước, độ dày, chất liệu, thời gian bảo hành) được cung cấp theo thông tin của nhà sản xuất. Màu sắc thực tế có thể chênh lệch nhẹ do màn hình hiển thị.</li>
<li>Giá hiển thị bằng Việt Nam đồng. Phí vận chuyển (nếu có) được thông báo và xác nhận với khách hàng trước khi giao.</li>
<li>Sản phẩm hiển thị “Liên hệ” chưa niêm yết giá: nhân viên báo giá cụ thể trước khi khách hàng quyết định mua.</li>
<li>Trường hợp giá hoặc thông tin bị sai do lỗi hệ thống, ${name} sẽ liên hệ khách hàng để xác nhận lại trước khi giao; khách hàng có quyền huỷ đơn mà không mất phí.</li>
</ul>
<h2>3. Quy trình đặt hàng và xác nhận</h2>
<ol>
${cartOn ? `<li>Chọn sản phẩm, kích thước, số lượng và bấm “Thêm vào giỏ” hoặc “Mua ngay”.</li>
<li>Tại trang thanh toán, kiểm tra lại toàn bộ thông tin đơn hàng (sản phẩm, số lượng, đơn giá, phí giao hàng, tổng tiền), nhập thông tin người nhận, chọn hình thức thanh toán.</li>
<li>Đánh dấu đồng ý với điều khoản này và chính sách bảo mật, sau đó bấm “Đặt hàng”. Website hiển thị mã đơn hàng ngay sau khi đặt.</li>` : `<li>Xem sản phẩm, giá và thông tin trên website, sau đó liên hệ đặt hàng qua hotline <b>${hotlines}</b>, Zalo, hoặc bấm “Gửi yêu cầu đặt hàng” và để lại họ tên, số điện thoại, sản phẩm cần mua (có đánh dấu đồng ý với điều khoản này và chính sách bảo mật).</li>
<li>Nhân viên báo lại đầy đủ thông tin đơn hàng gồm sản phẩm, kích thước, số lượng, đơn giá, phí giao hàng, tổng tiền và hình thức thanh toán để khách hàng kiểm tra.</li>`}
<li>Nhân viên ${name} gọi điện xác nhận đơn hàng, thời gian và địa điểm giao. Hợp đồng mua bán được xác lập khi ${name} xác nhận đơn hàng với khách.</li>
</ol>
<h2>4. Huỷ và thay đổi đơn hàng</h2>
<p>Khách hàng được huỷ hoặc thay đổi đơn miễn phí trước khi hàng được giao cho đơn vị vận chuyển hoặc nhân viên giao hàng, bằng cách liên hệ ${contact}. Nếu đã thanh toán trước, ${name} hoàn lại toàn bộ số tiền theo <a href="/chinh-sach/doi-tra">Chính sách đổi trả & hoàn tiền</a>.</p>
<h2>5. Giao hàng, kiểm hàng, thanh toán, đổi trả, bảo hành</h2>
<p>Thực hiện theo các chính sách: <a href="/chinh-sach/giao-hang">Giao hàng & lắp đặt</a>, <a href="/chinh-sach/kiem-hang">Kiểm hàng</a>, <a href="/chinh-sach/thanh-toan">Hình thức thanh toán</a>, <a href="/chinh-sach/doi-tra">Đổi trả & hoàn tiền</a>, <a href="/chinh-sach/bao-hanh">Bảo hành</a>.</p>
<h2>6. Quyền và trách nhiệm của khách hàng</h2>
<ul>
<li>Cung cấp thông tin người nhận chính xác, đầy đủ; kiểm tra hàng khi nhận.</li>
<li>Được cung cấp thông tin trung thực về sản phẩm, được đổi trả, bảo hành và khiếu nại theo chính sách đã công bố và quy định pháp luật.</li>
<li>Không sử dụng website để đặt hàng giả mạo, gây rối hoặc thu thập trái phép thông tin.</li>
</ul>
<h2>7. Quyền và trách nhiệm của ${name}</h2>
<ul>
<li>Cung cấp hàng chính hãng, đúng chủng loại, số lượng, chất lượng như đã xác nhận; xuất hoá đơn, chứng từ theo quy định khi khách hàng yêu cầu.</li>
<li>Bảo mật thông tin khách hàng theo <a href="/chinh-sach/bao-mat">Chính sách bảo mật</a>.</li>
<li>Được từ chối hoặc huỷ đơn hàng có dấu hiệu gian lận, thông tin không liên lạc được, hoặc sản phẩm hết hàng (sẽ thông báo cho khách hàng).</li>
</ul>
<h2>8. Giải quyết tranh chấp và luật áp dụng</h2>
<p>Mọi khiếu nại được giải quyết theo <a href="/chinh-sach/khieu-nai">Chính sách giải quyết khiếu nại</a> trên cơ sở thương lượng. Điều khoản này được điều chỉnh theo pháp luật Việt Nam.</p>
<h2>9. Hiệu lực</h2>
<p>Điều khoản có hiệu lực kể từ ngày đăng tải. ${name} có thể cập nhật điều khoản và sẽ công bố trên website; đơn hàng đã xác nhận trước thời điểm cập nhật áp dụng điều khoản tại thời điểm đặt hàng.</p>`,
    },
    'giao-hang': {
      title: 'Chính sách giao hàng & lắp đặt',
      body: `
<h2>1. Phạm vi giao hàng</h2>
<p>${name} vận chuyển toàn quốc. Đơn hàng có địa chỉ giao trong bán kính dưới 20km tính từ cửa hàng do nhân viên ${name} trực tiếp giao và lắp đặt; các khu vực khác giao qua đơn vị vận chuyển (nhà xe, công ty chuyển phát).</p>
<h2>2. Phí giao hàng</h2>
<ul>
<li><b>Miễn phí vận chuyển</b> cho đơn hàng có địa chỉ giao trong bán kính dưới 20km tính từ cửa hàng (${addrs.map(esc).join(' hoặc ')}), đã bao gồm công lắp đặt.</li>
<li>Đơn hàng từ 20km trở lên và các tỉnh thành khác: ${fee ? `phí giao mặc định ${vnd(fee)}/đơn` : 'phí tính theo bảng giá của đơn vị vận chuyển'}${freeMin ? `; miễn phí cho đơn từ ${vnd(freeMin)}` : ''}. Phí được nhân viên thông báo và được khách hàng đồng ý trước khi giao; không phát sinh thêm chi phí nào khác.</li>
</ul>
<h2>3. Thời gian giao hàng</h2>
<ul>
<li>Trong bán kính 20km: 2–24 giờ kể từ khi xác nhận đơn (hàng có sẵn).</li>
<li>Tỉnh thành khác: 2–5 ngày làm việc.</li>
<li>Hàng đặt theo kích thước riêng hoặc tạm hết: nhân viên thông báo thời gian cụ thể khi xác nhận đơn.</li>
</ul>
<h2>4. Chứng từ kèm theo</h2>
<p>Mỗi đơn hàng có phiếu giao hàng ghi rõ sản phẩm, số lượng, số tiền; kèm phiếu/thẻ bảo hành của hãng. Hoá đơn, chứng từ khác được cung cấp theo quy định khi khách hàng yêu cầu.</p>
<h2>5. Trách nhiệm với hàng hoá trong quá trình vận chuyển</h2>
<p>${name} chịu trách nhiệm về hàng hoá cho đến khi giao cho khách hàng. Trường hợp hàng bị hư hỏng, móp méo, ướt, sai mẫu hoặc thất lạc trong quá trình vận chuyển, khách hàng có quyền từ chối nhận và ${name} sẽ giao lại hàng mới hoặc hoàn tiền 100% đã thanh toán.</p>
<h2>6. Liên hệ</h2>
<p>Theo dõi đơn hàng hoặc thay đổi thời gian giao: ${contact}. Giờ làm việc: ${hours}.</p>`,
    },
    'kiem-hang': {
      title: 'Chính sách kiểm hàng',
      body: `
<p>${name} khuyến khích và tạo điều kiện để khách hàng kiểm tra hàng trước khi nhận và thanh toán.</p>
<h2>1. Khách hàng được kiểm tra những gì</h2>
<ul>
<li>Đúng sản phẩm, thương hiệu, kích thước, độ dày, màu sắc, số lượng như đơn hàng đã xác nhận.</li>
<li>Tình trạng bên ngoài: bao bì, tem nhãn chính hãng, vỏ bọc, đường may; không rách, bẩn, ẩm mốc, móp méo.</li>
<li>Phụ kiện, quà tặng kèm theo và phiếu bảo hành.</li>
<li>Với hàng do nhân viên ${name} lắp đặt: khách hàng được kiểm tra sau khi lắp đặt xong, nằm thử trước khi ký nhận.</li>
</ul>
<h2>2. Cách thức kiểm tra</h2>
<p>Khách hàng được mở bao bì ngoài để kiểm tra khi nhận hàng, có mặt nhân viên giao hàng. Với đệm cuộn hút chân không, khách hàng kiểm tra tem nhãn, kích thước in trên bao bì; sau khi mở hút chân không nếu phát hiện lỗi sản xuất vẫn được đổi theo <a href="/chinh-sach/doi-tra">Chính sách đổi trả</a>.</p>
<h2>3. Khi hàng không đúng hoặc có lỗi</h2>
<p>Khách hàng có quyền từ chối nhận hàng và không phải thanh toán bất kỳ khoản phí nào (kể cả phí vận chuyển). ${name} sẽ giao lại sản phẩm đúng hoặc hoàn tiền nếu khách hàng đã thanh toán trước. Vui lòng báo ngay cho ${name} qua ${contact}.</p>`,
    },
    'thanh-toan': {
      title: 'Hình thức thanh toán',
      body: `
<h2>1. Thanh toán khi nhận hàng (COD)</h2>
<p>Khách hàng thanh toán bằng tiền mặt hoặc chuyển khoản cho nhân viên giao hàng sau khi đã kiểm tra hàng theo <a href="/chinh-sach/kiem-hang">Chính sách kiểm hàng</a>. Không thu thêm phí thu hộ.</p>
<h2>2. Chuyển khoản ngân hàng / quét mã VietQR</h2>
<p>${cartOn ? 'Sau khi đặt hàng, trang xác nhận hiển thị mã VietQR có sẵn số tiền và nội dung chuyển khoản (mã đơn hàng).' : 'Sau khi đơn hàng được xác nhận qua điện thoại/Zalo, nhân viên gửi thông tin tài khoản, số tiền và nội dung chuyển khoản.'} Nhân viên xác nhận khi nhận được tiền.</p>
${bank}
<h2>3. Thanh toán tại cửa hàng</h2>
<p>Khách hàng có thể đến trực tiếp cửa hàng để xem hàng, nằm thử và thanh toán bằng tiền mặt, chuyển khoản hoặc thẻ.</p>
<h2>4. Trả góp qua thẻ tín dụng</h2>
<p>Hỗ trợ trả góp qua thẻ tín dụng theo chương trình của ngân hàng phát hành thẻ. Điều kiện, kỳ hạn và phí (nếu có) được nhân viên thông báo trước khi giao dịch.</p>
<h2>5. Đặt cọc</h2>
<p>Với hàng đặt riêng theo kích thước, ${name} có thể đề nghị đặt cọc; số tiền cọc được trừ vào giá trị đơn hàng và được hoàn lại nếu ${name} không giao được hàng đúng hẹn.</p>
<h2>6. Hoá đơn, chứng từ</h2>
<p>Khách hàng nhận phiếu giao hàng/biên nhận cho mọi giao dịch; hoá đơn, chứng từ khác được cung cấp theo quy định khi khách hàng yêu cầu.</p>`,
    },
    'doi-tra': {
      title: 'Chính sách đổi trả & hoàn tiền',
      body: `
<h2>1. Thời hạn đổi trả</h2>
<p>Trong vòng <b>${days} ngày</b> kể từ ngày nhận hàng.</p>
<h2>2. Trường hợp được đổi trả miễn phí</h2>
<ul>
<li>Sản phẩm có lỗi của nhà sản xuất (lún, xẹp, bung keo, lò xo gãy/nhô, đường may lỗi…).</li>
<li>Giao sai sản phẩm, sai kích thước, sai màu so với đơn hàng đã xác nhận.</li>
<li>Sản phẩm bị hư hỏng trong quá trình vận chuyển.</li>
</ul>
<p>Với các trường hợp trên, ${name} chịu toàn bộ chi phí vận chuyển và lắp đặt khi đổi trả.</p>
<h2>3. Đổi theo nhu cầu (không do lỗi)</h2>
<p>Khách hàng muốn đổi sang mẫu hoặc kích thước khác được hỗ trợ khi sản phẩm còn nguyên vẹn, chưa qua sử dụng, còn đầy đủ tem nhãn, bao bì, phụ kiện và quà tặng. Khách hàng thanh toán phần chênh lệch giá (nếu có) và chi phí vận chuyển phát sinh; nhân viên thông báo chi phí trước khi đổi.</p>
<h2>4. Trường hợp không áp dụng</h2>
<ul>
<li>Sản phẩm bị hư hỏng do sử dụng sai hướng dẫn, ngấm nước, bị bẩn, rách do tác động bên ngoài.</li>
<li>Sản phẩm sản xuất theo kích thước riêng theo yêu cầu (trừ trường hợp lỗi sản xuất).</li>
<li>Chăn, ga, gối, vỏ gối đã mở bao bì và qua sử dụng, vì lý do vệ sinh (trừ trường hợp lỗi sản xuất).</li>
</ul>
<h2>5. Quy trình đổi trả</h2>
<ol>
<li>Liên hệ ${contact}, cung cấp mã đơn hàng/số điện thoại đặt hàng, mô tả và hình ảnh tình trạng sản phẩm.</li>
<li>${name} xác nhận trong vòng 24 giờ làm việc và hẹn lịch thu hồi/đổi hàng.</li>
<li>Nhân viên kiểm tra sản phẩm, đổi hàng mới hoặc tiến hành hoàn tiền.</li>
</ol>
<h2>6. Hoàn tiền</h2>
<p>Khi trả hàng hợp lệ hoặc huỷ đơn đã thanh toán, ${name} hoàn tiền trong vòng <b>7 ngày làm việc</b> kể từ khi nhận lại hàng (hoặc từ khi huỷ đơn), bằng chuyển khoản vào tài khoản do khách hàng cung cấp hoặc tiền mặt tại cửa hàng. Số tiền hoàn bằng số tiền khách đã thanh toán cho sản phẩm trả lại.</p>`,
    },
    'bao-hanh': {
      title: 'Chính sách bảo hành',
      body: `
<h2>1. Thời hạn bảo hành</h2>
<p>Sản phẩm được bảo hành chính hãng theo thời hạn ghi trên website và phiếu/thẻ bảo hành của nhà sản xuất (từ 3 đến 20 năm tuỳ dòng sản phẩm), tính từ ngày giao hàng.</p>
<h2>2. Điều kiện bảo hành</h2>
<ul>
<li>Sản phẩm còn thời hạn bảo hành, còn tem/nhãn của nhà sản xuất; có phiếu bảo hành hoặc thông tin đơn hàng (số điện thoại mua hàng).</li>
<li>Lỗi do nhà sản xuất: đệm lún, xẹp quá 3cm (khi không có tải), bung keo, lò xo gãy hoặc nhô, khung/viền biến dạng.</li>
</ul>
<h2>3. Không thuộc phạm vi bảo hành</h2>
<ul>
<li>Hư hỏng do sử dụng sai hướng dẫn: gấp, uốn đệm không cho phép gấp; nhảy, đứng tập trung trên đệm; đặt trên mặt phẳng không bằng phẳng.</li>
<li>Đệm bị ngấm nước, ẩm mốc, côn trùng, cháy, rách, bẩn do tác động bên ngoài; sự thay đổi độ mềm tự nhiên của vật liệu trong quá trình sử dụng.</li>
</ul>
<h2>4. Quy trình bảo hành</h2>
<ol>
<li>Liên hệ ${contact}, cung cấp hình ảnh và mô tả lỗi.</li>
<li>${name} kiểm tra, xác định lỗi (tại nhà hoặc tại cửa hàng) và chuyển hãng sửa chữa hoặc đổi mới theo chính sách của hãng.</li>
<li>Khu vực Hải Phòng: ${name} hỗ trợ vận chuyển hàng bảo hành miễn phí.</li>
</ol>`,
    },
    'tra-gop': {
      title: 'Mua trả góp',
      body: `<p>Hỗ trợ trả góp qua thẻ tín dụng theo chương trình của các ngân hàng liên kết. Lãi suất, kỳ hạn, phí chuyển đổi (nếu có) theo quy định của ngân hàng phát hành thẻ và được nhân viên thông báo rõ trước khi giao dịch.</p><p>Liên hệ hotline <b>${hotline}</b> để được kiểm tra điều kiện và hướng dẫn.</p>`,
    },
    'bao-mat': {
      title: 'Chính sách bảo mật thông tin',
      body: `
<p>${owner} (“${name}”) tôn trọng và bảo vệ dữ liệu cá nhân của khách hàng theo quy định pháp luật Việt Nam về bảo vệ dữ liệu cá nhân và thương mại điện tử.</p>
<h2>1. Mục đích thu thập thông tin</h2>
<ul>
<li>Xử lý, xác nhận và giao đơn hàng; liên hệ tư vấn, báo giá khi khách hàng yêu cầu gọi lại hoặc đăng ký nhận voucher.</li>
<li>Bảo hành, đổi trả, chăm sóc sau bán hàng; giải quyết khiếu nại.</li>
<li>Gửi thông tin ưu đãi (chỉ khi khách hàng đã đồng ý; có thể yêu cầu ngừng nhận bất cứ lúc nào).</li>
<li>Thống kê, cải thiện website và hiệu quả quảng cáo (dữ liệu ẩn danh).</li>
</ul>
<h2>2. Phạm vi thông tin thu thập</h2>
<ul>
<li>Thông tin khách hàng tự cung cấp: họ tên, số điện thoại, email, địa chỉ giao hàng, ghi chú đơn hàng, nội dung đánh giá.</li>
<li>Thông tin kỹ thuật tự động: cookie, địa chỉ IP, loại trình duyệt, trang đã xem. Website sử dụng Google Analytics và Meta Pixel (Facebook) để đo lường lượt truy cập và quảng cáo; khách hàng có thể chặn hoặc xoá cookie trong cài đặt trình duyệt.</li>
</ul>
<p>${name} không thu thập thông tin thẻ ngân hàng của khách hàng trên website.</p>
<h2>3. Phạm vi sử dụng thông tin</h2>
<p>Thông tin chỉ được dùng cho các mục đích nêu tại mục 1 và trong nội bộ ${name}. Không bán, trao đổi hay chia sẻ cho bên thứ ba, trừ các trường hợp: đơn vị vận chuyển (họ tên, số điện thoại, địa chỉ để giao hàng); nhà sản xuất (khi kích hoạt bảo hành); hoặc khi cơ quan nhà nước có thẩm quyền yêu cầu theo quy định pháp luật.</p>
<h2>4. Thời gian lưu trữ</h2>
<p>Thông tin được lưu trữ trong suốt thời gian cần thiết để thực hiện đơn hàng và bảo hành sản phẩm (tối đa bằng thời hạn bảo hành dài nhất của sản phẩm đã mua), hoặc cho đến khi khách hàng yêu cầu xoá, trừ trường hợp pháp luật yêu cầu lưu trữ lâu hơn (ví dụ chứng từ kế toán).</p>
<h2>5. Những người hoặc tổ chức có thể được tiếp cận</h2>
<p>Chủ cửa hàng và nhân viên bán hàng, giao hàng, chăm sóc khách hàng của ${name}; các bên nêu tại mục 3 trong phạm vi cần thiết.</p>
<h2>6. Đơn vị thu thập và quản lý thông tin</h2>
<p><b>${owner}</b><br>Địa chỉ: ${hq}<br>Điện thoại: ${hotlines}${email ? `<br>Email: ${email}` : ''}${web ? `<br>Website: ${web}` : ''}</p>
<h2>7. Phương tiện và công cụ để khách hàng tiếp cận, chỉnh sửa dữ liệu</h2>
<p>Khách hàng có quyền yêu cầu xem, chỉnh sửa, xoá dữ liệu cá nhân, rút lại sự đồng ý hoặc ngừng nhận tin quảng cáo bằng cách liên hệ ${contact}. ${name} thực hiện yêu cầu trong vòng 72 giờ làm việc.</p>
<h2>8. Cam kết bảo mật</h2>
<p>Dữ liệu được lưu trên máy chủ có kết nối mã hoá (HTTPS), chỉ người có thẩm quyền mới truy cập được trang quản trị. Khi phát hiện sự cố lộ lọt dữ liệu, ${name} sẽ thông báo cho khách hàng và cơ quan chức năng theo quy định.</p>
<h2>9. Cơ chế tiếp nhận và giải quyết khiếu nại liên quan đến dữ liệu cá nhân</h2>
<p>Khách hàng gửi phản ánh qua ${contact}. ${name} phản hồi trong vòng 72 giờ làm việc và giải quyết theo <a href="/chinh-sach/khieu-nai">Chính sách giải quyết khiếu nại</a>.</p>`,
    },
    'khieu-nai': {
      title: 'Chính sách giải quyết khiếu nại',
      body: `
<h2>1. Kênh tiếp nhận khiếu nại</h2>
<p>Khách hàng gửi khiếu nại về sản phẩm, dịch vụ, giao hàng hoặc thông tin cá nhân qua ${contact}. Giờ làm việc: ${hours}.</p>
<h2>2. Quy trình giải quyết</h2>
<ol>
<li><b>Tiếp nhận:</b> ${name} ghi nhận khiếu nại và phản hồi xác nhận trong vòng 24 giờ làm việc.</li>
<li><b>Xác minh:</b> trong vòng 3 ngày làm việc, ${name} kiểm tra thông tin đơn hàng, hình ảnh, sản phẩm (có thể đến tận nơi) và phối hợp với nhà sản xuất, đơn vị vận chuyển nếu cần.</li>
<li><b>Giải quyết:</b> đưa ra phương án (đổi hàng, sửa chữa, bảo hành, hoàn tiền, bồi thường) và thống nhất với khách hàng. Thời gian giải quyết không quá 7 ngày làm việc kể từ ngày tiếp nhận, trừ trường hợp cần nhà sản xuất giám định.</li>
<li><b>Phản hồi kết quả</b> cho khách hàng bằng điện thoại/Zalo/email.</li>
</ol>
<h2>3. Nguyên tắc</h2>
<p>${name} tôn trọng quyền lợi chính đáng của người tiêu dùng, giải quyết trên tinh thần thương lượng, hoà giải. Trường hợp không đạt được thoả thuận, một trong các bên có thể đề nghị cơ quan quản lý nhà nước có thẩm quyền về bảo vệ quyền lợi người tiêu dùng, trọng tài hoặc Toà án giải quyết theo quy định của pháp luật.</p>
<h2>4. Trách nhiệm cung cấp thông tin</h2>
<p>${name} cam kết cung cấp đầy đủ chứng từ, thông tin giao dịch liên quan khi khách hàng hoặc cơ quan có thẩm quyền yêu cầu để phục vụ việc giải quyết tranh chấp.</p>`,
    },
  };
}

module.exports = { build };
