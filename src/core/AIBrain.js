const Destination = require('../models/Destination');

class AIBrain {
    async generateResponse(message, destinationId = null) {
        const input = message.toLowerCase();
        
        // 1. Get context if destinationId is provided
        let context = "";
        if (destinationId) {
            const dest = await Destination.findById(destinationId);
            if (dest) {
                context = `Bạn đang hỏi về ${dest.name}. ${dest.short_desc}. Giờ mở cửa: ${dest.open_hours}. Giá: ${dest.cost}.`;
            }
        }

        // 2. Simple NLP Logic (Rebuilding into a "Smart Brain")
        if (input.includes('xin chào') || input.includes('hi') || input.includes('hello')) {
            return "Xin chào! Tôi là trợ lý ảo của Bình Lợi Healing. Tôi có thể giúp gì cho hành trình của bạn?";
        }

        if (input.includes('giờ') || input.includes('mở cửa') || input.includes('đóng cửa')) {
            if (destinationId) return context + " Bạn nên ghé thăm trong khung giờ này nhé.";
            return "Đa số các điểm tham quan mở cửa từ 8:00 đến 17:00. Bạn muốn hỏi cụ thể địa điểm nào?";
        }

        if (input.includes('giá') || input.includes('tiền') || input.includes('phí')) {
            if (destinationId) return context + " Bạn có thể thanh toán trực tiếp tại điểm đến.";
            return "Giá vé tại Bình Lợi dao động từ miễn phí đến 50.000đ. Các workshop trải nghiệm có thể có phí riêng.";
        }

        if (input.includes('đường đi') || input.includes('vị trí') || input.includes('ở đâu')) {
            return "Bình Lợi nằm ở huyện Bình Chánh, TP.HCM. Bạn có thể sử dụng bản đồ tích hợp trong app để xem đường đi chi tiết nhất.";
        }

        if (input.includes('cảm ơn') || input.includes('thanks')) {
            return "Rất sẵn lòng! Chúc bạn có một hành trình chữa lành thật tuyệt vời tại Bình Lợi.";
        }

        // 3. Fallback
        return "Câu hỏi của bạn rất thú vị! Tôi sẽ chuyển thông tin này đến Ban quản lý để trả lời bạn chi tiết hơn. Bạn có muốn khám phá thêm các điểm đến khác không?";
    }
}

module.exports = new AIBrain();
