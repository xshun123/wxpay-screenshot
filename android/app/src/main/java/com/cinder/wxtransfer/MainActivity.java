package com.cinder.wxtransfer;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ContentValues;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Matrix;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.Toast;

import com.google.zxing.BinaryBitmap;
import com.google.zxing.DecodeHintType;
import com.google.zxing.MultiFormatReader;
import com.google.zxing.Result;
import com.google.zxing.common.HybridBinarizer;
import com.google.zxing.RGBLuminanceSource;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.util.EnumMap;
import java.util.Map;

public class MainActivity extends Activity {

    private static final String DIR_NAME = "微信转账模拟器";
    private static final int REQ_STORAGE = 1;
    private static final int REQ_FILE = 2;
    private static final int REQ_CAMERA = 3;

    private WebView web;
    private ValueCallback<Uri[]> filePathCallback;
    private PermissionRequest pendingCamReq;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q
                && checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE)
                != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.WRITE_EXTERNAL_STORAGE}, REQ_STORAGE);
        }

        web = new WebView(this);
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(true);
        s.setUseWideViewPort(true);
        s.setLoadWithOverviewMode(false);
        s.setTextZoom(100);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setCacheMode(WebSettings.LOAD_NO_CACHE);
        s.setMediaPlaybackRequiresUserGesture(false);

        web.setBackgroundColor(0xFFEDEDED);
        web.setOverScrollMode(WebView.OVER_SCROLL_NEVER);
        web.addJavascriptInterface(new Bridge(), "Android");

        // 让页面里的 <input type="file"> 能选相册图片（头像、收款码截图）
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback,
                                             FileChooserParams params) {
                if (filePathCallback != null) {
                    filePathCallback.onReceiveValue(null);
                }
                filePathCallback = callback;
                try {
                    Intent intent = params.createIntent();
                    intent.addCategory(Intent.CATEGORY_OPENABLE);
                    startActivityForResult(intent, REQ_FILE);
                    return true;
                } catch (Exception e) {
                    filePathCallback = null;
                    return false;
                }
            }

            // 相机扫码：页面 getUserMedia 时把 VIDEO_CAPTURE 授权给 WebView
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        boolean wantCamera = false;
                        for (String r : request.getResources()) {
                            if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(r)) wantCamera = true;
                        }
                        if (wantCamera
                                && checkSelfPermission(Manifest.permission.CAMERA)
                                != PackageManager.PERMISSION_GRANTED) {
                            pendingCamReq = request;
                            requestPermissions(new String[]{Manifest.permission.CAMERA}, REQ_CAMERA);
                            return;
                        }
                        try {
                            request.grant(request.getResources());
                        } catch (Exception e) {
                            request.deny();
                        }
                    }
                });
            }
        });

        web.loadUrl("file:///android_asset/index.html");
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == REQ_FILE) {
            if (filePathCallback == null) return;
            Uri[] results = null;
            if (resultCode == RESULT_OK && data != null) {
                if (data.getClipData() != null) {
                    int count = data.getClipData().getItemCount();
                    results = new Uri[count];
                    for (int i = 0; i < count; i++) {
                        results[i] = data.getClipData().getItemAt(i).getUri();
                    }
                } else if (data.getData() != null) {
                    results = new Uri[]{data.getData()};
                }
            }
            filePathCallback.onReceiveValue(results);
            filePathCallback = null;
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(requestCode, permissions, results);
        if (requestCode == REQ_CAMERA && pendingCamReq != null) {
            if (results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED) {
                try {
                    pendingCamReq.grant(pendingCamReq.getResources());
                } catch (Exception e) {
                    pendingCamReq.deny();
                }
            } else {
                pendingCamReq.deny();
                Toast.makeText(this, "相机权限被拒绝，改用相册选码", Toast.LENGTH_SHORT).show();
            }
            pendingCamReq = null;
        }
    }

    @Override
    public void onBackPressed() {
        if (web != null && web.canGoBack()) {
            web.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onDestroy() {
        if (filePathCallback != null) {
            filePathCallback.onReceiveValue(null);
            filePathCallback = null;
        }
        if (web != null) {
            web.removeJavascriptInterface("Android");
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }

    /** 前端 window.Android.* 的落地端 */
    private class Bridge {

        @JavascriptInterface
        public void saveImage(String base64, String name) {
            try {
                if (base64 == null || base64.isEmpty()) {
                    throw new IllegalArgumentException("图片数据为空");
                }
                byte[] data = Base64.decode(base64, Base64.DEFAULT);
                String safeName = (name == null || name.trim().isEmpty())
                        ? "wxtransfer_" + System.currentTimeMillis() + ".png"
                        : name.replaceAll("[\\\\/:*?\"<>|]", "_");

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    ContentValues v = new ContentValues();
                    v.put(MediaStore.Images.Media.DISPLAY_NAME, safeName);
                    v.put(MediaStore.Images.Media.MIME_TYPE, "image/png");
                    v.put(MediaStore.Images.Media.RELATIVE_PATH,
                            Environment.DIRECTORY_PICTURES + "/" + DIR_NAME);

                    Uri uri = getContentResolver()
                            .insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, v);
                    if (uri == null) {
                        throw new IllegalStateException("MediaStore 插入失败");
                    }
                    try (OutputStream os = getContentResolver().openOutputStream(uri)) {
                        if (os == null) {
                            throw new IllegalStateException("输出流为空");
                        }
                        os.write(data);
                        os.flush();
                    }
                } else {
                    if (checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE)
                            != PackageManager.PERMISSION_GRANTED) {
                        toast("请先允许存储权限，再保存");
                        return;
                    }
                    File dir = new File(
                            Environment.getExternalStoragePublicDirectory(
                                    Environment.DIRECTORY_PICTURES), DIR_NAME);
                    if (!dir.exists() && !dir.mkdirs()) {
                        throw new IllegalStateException("无法创建目录");
                    }
                    File f = new File(dir, safeName);
                    try (FileOutputStream fos = new FileOutputStream(f)) {
                        fos.write(data);
                        fos.flush();
                    }
                }
                toast("已保存到相册 / Pictures/" + DIR_NAME);
            } catch (Exception e) {
                toast("保存失败：" + e.getMessage());
            }
        }

        /** 传入图片 base64，返回二维码文本；识别不到返回空串 */
        @JavascriptInterface
        public String decodeQr(String base64) {
            Bitmap bmp = null;
            try {
                if (base64 == null || base64.isEmpty()) return "";
                if (base64.indexOf(",") >= 0) {
                    base64 = base64.substring(base64.indexOf(',') + 1);
                }
                byte[] bytes = Base64.decode(base64, Base64.DEFAULT);

                BitmapFactory.Options o = new BitmapFactory.Options();
                o.inJustDecodeBounds = true;
                BitmapFactory.decodeByteArray(bytes, 0, bytes.length, o);
                int sample = 1;
                while (o.outWidth / sample > 1400 || o.outHeight / sample > 1400) {
                    sample *= 2;
                }
                o.inJustDecodeBounds = false;
                o.inSampleSize = sample;
                bmp = BitmapFactory.decodeByteArray(bytes, 0, bytes.length, o);
                if (bmp == null) return "";

                String text = decodeBitmap(bmp);
                int[] angles = new int[]{90, 180, 270};
                for (int i = 0; i < angles.length && text.isEmpty(); i++) {
                    Bitmap rot = rotate(bmp, angles[i]);
                    if (rot == null) continue;
                    text = decodeBitmap(rot);
                    rot.recycle();
                }
                return text == null ? "" : text;
            } catch (Throwable t) {
                return "";
            } finally {
                if (bmp != null && !bmp.isRecycled()) bmp.recycle();
            }
        }

        private String decodeBitmap(Bitmap bmp) {
            int w = bmp.getWidth();
            int h = bmp.getHeight();
            int[] pixels = new int[w * h];
            bmp.getPixels(pixels, 0, w, 0, 0, w, h);

            RGBLuminanceSource source = new RGBLuminanceSource(w, h, pixels);
            BinaryBitmap bitmap = new BinaryBitmap(new HybridBinarizer(source));

            Map<DecodeHintType, Object> hints = new EnumMap<>(DecodeHintType.class);
            hints.put(DecodeHintType.TRY_HARDER, Boolean.TRUE);

            MultiFormatReader reader = new MultiFormatReader();
            reader.setHints(hints);
            try {
                Result result = reader.decodeWithState(bitmap);
                String text = result == null ? null : result.getText();
                return text == null ? "" : text;
            } catch (Throwable t) {
                return "";
            } finally {
                reader.reset();
            }
        }

        private Bitmap rotate(Bitmap src, int degrees) {
            try {
                Matrix m = new Matrix();
                m.postRotate(degrees);
                return Bitmap.createBitmap(src, 0, 0, src.getWidth(), src.getHeight(), m, true);
            } catch (Throwable t) {
                return null;
            }
        }

        private void toast(final String msg) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    Toast.makeText(MainActivity.this, msg, Toast.LENGTH_SHORT).show();
                }
            });
        }
    }
}
