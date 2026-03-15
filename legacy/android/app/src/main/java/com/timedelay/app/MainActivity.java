package com.timedelay.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.timedelay.app.plugins.camera.CameraRecorderPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(CameraRecorderPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
