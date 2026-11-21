// Yeni seçilen görselleri yönetir (yeni proje ve proje düzenleme sayfaları).
// - Sunucuyla aynı kuralları uygular: JPG/PNG/WEBP, görsel başına 10 MB,
//   tek seferde en fazla 10 görsel.
// - Önizlemeleri seçim sırasıyla ve hemen oluşturur; bu yüzden bir
//   önizlemeyi kaldırmak her zaman tam o dosyayı kaldırır.
window.ImagePicker = (function () {
    const MAX_FILE_SIZE = 10 * 1024 * 1024;
    const MAX_FILES = 10;
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

    function create({ onError, onChange }) {
        let files = [];

        const picker = {
            get files() {
                return files.slice();
            },

            add(fileList) {
                const incoming = Array.from(fileList);
                const unsupported = incoming.find(f => !ALLOWED_TYPES.includes(f.type));
                if (unsupported) {
                    return onError(`"${unsupported.name}" desteklenmiyor. Yalnızca JPG, PNG veya WEBP yükleyebilirsiniz.`);
                }
                const tooBig = incoming.find(f => f.size > MAX_FILE_SIZE);
                if (tooBig) {
                    return onError(`"${tooBig.name}" 10 MB'tan büyük. Her görsel en fazla 10 MB olabilir.`);
                }
                if (files.length + incoming.length > MAX_FILES) {
                    return onError(`Tek seferde en fazla ${MAX_FILES} yeni görsel ekleyebilirsiniz.`);
                }
                files = files.concat(incoming);
                onChange();
            },

            remove(index) {
                files.splice(index, 1);
                onChange();
            },

            // Seçili dosyalar için önizleme öğeleri (seçim sırasıyla)
            previews() {
                return files.map((file, index) => {
                    const item = document.createElement('div');
                    item.className = 'image-preview';

                    const img = document.createElement('img');
                    img.src = URL.createObjectURL(file);
                    img.alt = file.name;
                    img.onload = img.onerror = () => URL.revokeObjectURL(img.src);

                    const remove = document.createElement('button');
                    remove.type = 'button';
                    remove.className = 'remove-image';
                    remove.setAttribute('aria-label', `${file.name} görselini kaldır`);
                    remove.innerHTML = '<i class="fas fa-times"></i>';
                    remove.addEventListener('click', (event) => {
                        event.stopPropagation();
                        picker.remove(index);
                    });

                    item.append(img, remove);
                    return item;
                });
            }
        };
        return picker;
    }

    return { create, MAX_FILE_SIZE, MAX_FILES, ALLOWED_TYPES };
})();
